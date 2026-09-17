"use server";

/**
 * AI 추출 모집요강 승인 — 대학당 요강 1개 모델(0067).
 *
 *   대학에 활성(보관 아님) 요강이 있으면 새로 만들지 않고 그 요강에 **합친다**:
 *     (a) 추출 학기 → study_spec_terms (있으면 건너뜀, 일정은 추출값 — 어학연수 요강이면 schedule_language, 아니면 schedule)
 *     (b) 추출 학과 → 학과 마스터를 이름으로 찾거나(0067b 규칙) 만들고, 요강 학과가 없으면 만든다
 *         (어학연수 요강이면 어학당, 어학연수 프로그램 정보는 어학당 info.language_program 에).
 *         새로 만드는 요강 학과에만 추출 자격을 넣고, 있는 요강 학과의 정보·자격은 덮어쓰지 않는다.
 *     (c) 표준에 연결된 발급서류 줄 → 이번에 만든/맞춘 요강 학과 중 항목 행이 없는 학과에만 항목 행
 *     (d) 작성서류·미연결 줄은 옛 JSONB 에 덧붙인다(이름 중복 제거)
 *     (e) (학기, 학과) 모집 행이 없으면 draft 로
 *     (f) 옛 JSONB 캐시 갱신 → 상세로
 *   활성 요강이 없으면 새로 만들고 같은 절차로 학과·학기·항목·모집을 채운다(어학당은 항상 하나 보장).
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import type { StudyAdmissionSpecUpdate } from "@/types/database";
import { ensureUniversityAndDepartments } from "@/lib/admission/ensure-records";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import { rowsFromLegacy, splitLegacyDocs, type LegacyDoc } from "@/lib/admission/spec-doc-items";
import {
  loadDocItemRowsByDepartment,
  loadSpecDepartments,
  refreshSpecLegacyCaches,
  writeDepartmentDocItems,
  type DepartmentInfo,
} from "@/lib/admission/spec-departments";
import {
  ensureDraftOffering,
  ensureLanguageSpecDepartment,
  findOrCreateDepartmentMaster,
  normDeptName,
  syncSpecLegacyTerm,
} from "@/lib/admission/spec-merge";

const PROGRAM_TYPES = ["language_program", "associate_2yr", "bachelor_3yr_extension", "bachelor_4yr"] as const;

const SPEC_AREAS = ["departments", "required_documents", "eligibility", "schedule", "tuition", "scholarships", "metadata"] as const;

const metaSchema = z
  .object({
    university_id: z.coerce.number().int().positive().optional().nullable(),
    new_university_name_ko: z.string().max(200).optional().nullable(),
    term: z.string().regex(/^\d{4}-(Spring|Fall|Summer|Winter|Year)$/),
    admission_category: z.string().max(200).optional().nullable(),
    program_type: z.enum(PROGRAM_TYPES),
    source_file_url: z.string().max(500).optional().nullable(),
  })
  .refine((d) => d.university_id != null || (d.new_university_name_ko != null && d.new_university_name_ko.trim() !== ""), {
    message: "대학을 선택하거나 신규 대학명을 입력하세요",
    path: ["university_id"],
  });

export type ApproveSpecState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | undefined;

const isNonEmptyObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length > 0;

export async function approveSpecAction(_prev: ApproveSpecState, formData: FormData): Promise<ApproveSpecState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };
  if (!isGlocareAdmin(user)) return { error: "권한이 없습니다" };

  // 1. 메타 검증
  const metaParsed = metaSchema.safeParse({
    university_id: formData.get("university_id") || null,
    new_university_name_ko: formData.get("new_university_name_ko") || null,
    term: formData.get("term"),
    admission_category: formData.get("admission_category") || null,
    program_type: formData.get("program_type"),
    source_file_url: formData.get("source_file_url") || null,
  });
  if (!metaParsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of metaParsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const meta = metaParsed.data;
  const isLanguage = meta.program_type === "language_program";

  // 2. JSON 영역 parse
  const jsonAreas: Record<string, unknown> = {};
  for (const area of SPEC_AREAS) {
    const raw = formData.get(`spec_${area}`);
    if (typeof raw !== "string" || raw.trim() === "") {
      jsonAreas[area] = area === "departments" || area === "required_documents" || area === "scholarships" ? [] : {};
      continue;
    }
    try {
      jsonAreas[area] = JSON.parse(raw);
    } catch (e) {
      return { fieldErrors: { [`spec_${area}`]: `JSON parse 실패: ${e instanceof Error ? e.message : String(e)}` } };
    }
  }
  let aiLog: unknown = null;
  const aiLogRaw = formData.get("ai_extraction_log");
  if (typeof aiLogRaw === "string" && aiLogRaw.trim()) {
    try {
      aiLog = JSON.parse(aiLogRaw);
    } catch {
      aiLog = { raw: aiLogRaw };
    }
  }
  const extractedDepts = (Array.isArray(jsonAreas.departments) ? jsonAreas.departments : []) as DepartmentInfo[];
  const legacyDocs = (Array.isArray(jsonAreas.required_documents) ? jsonAreas.required_documents : []) as LegacyDoc[];
  const eligibility = isNonEmptyObject(jsonAreas.eligibility) ? jsonAreas.eligibility : null;

  // 3. 대학 확정 (미등록은 active=false 로 만든다). 학과는 아래에서 0067b 규칙으로 따로 맞춘다.
  const ensured = await ensureUniversityAndDepartments({
    universityId: meta.university_id ?? null,
    newUniversityNameKo: meta.new_university_name_ko ?? null,
    programType: meta.program_type,
    departments: [],
  });
  if (!ensured.ok) return { error: ensured.error };
  const universityId = ensured.result.universityId;

  const admin = createAdminClient();

  // 4. 온라인 접수 + 가이드 문서 (선택)
  const isOnline = formData.get("is_online_submission") === "on";
  const onlineFormUrlRaw = formData.get("online_form_url");
  const onlineFormUrl = isOnline && typeof onlineFormUrlRaw === "string" && onlineFormUrlRaw.trim() ? onlineFormUrlRaw.trim() : null;
  let onlineGuideUrl: string | null = null;
  const guideB64 = formData.get("guide_base64");
  if (isOnline && typeof guideB64 === "string" && guideB64.trim() !== "") {
    const guideName = String(formData.get("guide_name") ?? "guide");
    const guideType = String(formData.get("guide_type") ?? "application/octet-stream");
    const safe = guideName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);
    const path = `admission-guides/${universityId}/${Date.now()}_${safe}`;
    const { error: upErr } = await admin.storage.from("admission-form-files").upload(path, Buffer.from(guideB64, "base64"), { contentType: guideType, upsert: false });
    if (upErr) return { error: `가이드 업로드 실패: ${upErr.message}` };
    onlineGuideUrl = admin.storage.from("admission-form-files").getPublicUrl(path).data.publicUrl;
  }

  // 5. 활성 요강이 있으면 합치고, 없으면 새로 만든다
  const nowIso = new Date().toISOString();
  const { data: existingSpecs } = await admin
    .from("study_admission_specs")
    .select("id, required_documents, metadata")
    .eq("university_id", universityId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1);
  const existing = existingSpecs?.[0] ?? null;

  let specId: string;
  if (!existing) {
    const { data: inserted, error: insertErr } = await admin
      .from("study_admission_specs")
      .insert({
        university_id: universityId,
        term: meta.term,
        admission_category: meta.admission_category,
        program_type: meta.program_type,
        departments: [],
        required_documents: legacyDocs,
        eligibility: eligibility ?? {},
        schedule: jsonAreas.schedule,
        tuition: jsonAreas.tuition,
        scholarships: jsonAreas.scholarships,
        metadata: jsonAreas.metadata,
        source_file_url: meta.source_file_url,
        ai_extraction_log: aiLog,
        is_online_submission: isOnline,
        online_form_url: onlineFormUrl,
        online_guide_url: onlineGuideUrl,
        status: "approved",
        approved_by: user.id,
        approved_at: nowIso,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) return { error: `DB INSERT 실패: ${insertErr?.message ?? "unknown"}` };
    specId = inserted.id;
  } else {
    specId = existing.id;
    // (d) 작성서류·미연결 줄 덧붙이기 (이름 중복 제거). 발급서류 줄은 아래 항목 행에서 다시 그려진다.
    const formDocKeys = await loadFormDocKeys(admin);
    const prev = (Array.isArray(existing.required_documents) ? existing.required_documents : []) as LegacyDoc[];
    const { keep: newKeep } = splitLegacyDocs(legacyDocs, formDocKeys);
    const names = new Set(prev.map((d) => normDeptName(String(d.name_ko ?? ""))));
    const appended = newKeep.filter((d) => {
      const n = normDeptName(String(d.name_ko ?? ""));
      if (!n || names.has(n)) return false;
      names.add(n);
      return true;
    });
    const prevMeta = isNonEmptyObject(existing.metadata) ? existing.metadata : {};
    const patch: StudyAdmissionSpecUpdate = {
      required_documents: [...prev, ...appended],
      // 기타 정보는 비어 있는 키만 채운다 (기존 값 우선)
      metadata: { ...(isNonEmptyObject(jsonAreas.metadata) ? jsonAreas.metadata : {}), ...prevMeta },
      ai_extraction_log: aiLog,
      updated_at: nowIso,
    };
    if (meta.source_file_url) patch.source_file_url = meta.source_file_url;
    if (meta.admission_category) patch.admission_category = meta.admission_category;
    if (isOnline) {
      patch.is_online_submission = true;
      patch.online_form_url = onlineFormUrl;
      if (onlineGuideUrl) patch.online_guide_url = onlineGuideUrl;
    }
    const { error: updErr } = await admin.from("study_admission_specs").update(patch).eq("id", specId);
    if (updErr) return { error: `요강 갱신 실패: ${updErr.message}` };
  }

  // (a) 학기 — 어학연수 요강이면 추출 일정을 어학당 일정(schedule_language)에, 아니면 일반학과 일정(schedule)에
  const { data: termRow } = await admin.from("study_spec_terms").select("id").eq("spec_id", specId).eq("term", meta.term).maybeSingle();
  if (!termRow) {
    const extractedSchedule = jsonAreas.schedule ?? {};
    const { error } = await admin.from("study_spec_terms").insert({
      spec_id: specId,
      term: meta.term,
      schedule: isLanguage ? {} : extractedSchedule,
      schedule_language: isLanguage ? extractedSchedule : {},
      sort_order: 0,
    });
    if (error) return { error: `학기 생성 실패: ${error.message}` };
  }

  // (b) 학과 — 이번 승인에서 만든/맞춘 요강 학과. 자격은 학과별(0068) — 이번에 만드는 학과에만 추출 자격을 넣고 기존 학과는 건드리지 않는다.
  const touched: Array<{ sdId: string; departmentId: number; created: boolean }> = [];
  const specDepts = await loadSpecDepartments(admin, specId);
  const createdDeptNames: string[] = [];
  if (isLanguage) {
    const extractedMeta = isNonEmptyObject(jsonAreas.metadata) ? jsonAreas.metadata : {};
    const languageProgram = isNonEmptyObject(extractedMeta.language_program) ? (extractedMeta.language_program as DepartmentInfo["language_program"]) : undefined;
    const lang = await ensureLanguageSpecDepartment(admin, specId, universityId, {
      info: { ...(extractedDepts[0] ?? {}), ...(languageProgram ? { language_program: languageProgram } : {}) },
      tuition: jsonAreas.tuition,
      scholarships: jsonAreas.scholarships,
      eligibility,
    });
    if (!lang.ok) return { error: lang.error };
    touched.push({ sdId: lang.id, departmentId: lang.department_id, created: lang.created });
  } else {
    let sortOrder = specDepts.reduce((m, d) => Math.max(m, d.sort_order), 0);
    const seen = new Set<number>();
    for (const d of extractedDepts) {
      const name = String(d?.name ?? "").trim();
      if (!name) continue;
      const master = await findOrCreateDepartmentMaster(admin, universityId, { language: false, name });
      if (!master.ok) return { error: master.error };
      if (seen.has(master.id)) continue;
      seen.add(master.id);
      if (master.created) createdDeptNames.push(name);
      const have = specDepts.find((sd) => sd.department_id === master.id);
      if (have) {
        touched.push({ sdId: have.id, departmentId: master.id, created: false });
        continue;
      }
      sortOrder += 10;
      const { data: created, error } = await admin
        .from("study_spec_departments")
        .insert({
          spec_id: specId,
          department_id: master.id,
          kind: "regular",
          info: { ...d, program_kind: "degree" },
          tuition: jsonAreas.tuition ?? {},
          scholarships: jsonAreas.scholarships ?? [],
          eligibility,
          sort_order: sortOrder,
        })
        .select("id")
        .single();
      if (error || !created) return { error: `요강 학과 생성 실패: ${error?.message ?? "unknown"}` };
      touched.push({ sdId: created.id, departmentId: master.id, created: true });
    }
    // 어학당은 항상 하나 (새로 만들 때만 추출 자격을 넣는다)
    const lang = await ensureLanguageSpecDepartment(admin, specId, universityId, { eligibility });
    if (!lang.ok) return { error: lang.error };
  }

  // (c) 발급서류 항목 행 — 항목 행이 없는 요강 학과에만
  const { data: items } = await admin.from("study_doc_items").select("key");
  const formDocKeys = await loadFormDocKeys(admin);
  const { linked } = splitLegacyDocs(legacyDocs, formDocKeys);
  const rows = rowsFromLegacy(linked, new Set((items ?? []).map((i) => i.key)));
  if (rows.length > 0) {
    const rowsByDept = await loadDocItemRowsByDepartment(admin, specId);
    for (const t of touched) {
      if ((rowsByDept.get(t.sdId) ?? []).length > 0) continue;
      const err = await writeDepartmentDocItems(admin, specId, t.sdId, rows);
      if (err) return { error: err };
    }
  }

  // (e) 모집 행
  for (const [i, t] of touched.entries()) {
    const err = await ensureDraftOffering(admin, universityId, t.departmentId, meta.term, specId, (i + 1) * 10);
    if (err) return { error: err };
  }

  // (f) 캐시 · term
  await syncSpecLegacyTerm(admin, specId);
  const cacheErr = await refreshSpecLegacyCaches(admin, specId);
  if (cacheErr) return { error: cacheErr };

  revalidatePath("/admissions");
  revalidatePath("/offerings");
  revalidatePath(`/admissions/${universityId}`);
  revalidatePath(`/admissions/specs/${specId}`);
  if (ensured.result.createdUniversity) revalidatePath("/universities");
  if (createdDeptNames.length > 0) {
    revalidatePath("/departments");
    revalidatePath(`/universities/${universityId}`);
  }
  redirect(`/admissions/specs/${specId}`);
}
