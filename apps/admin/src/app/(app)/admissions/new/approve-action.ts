"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  ensureUniversityAndDepartments,
  type SpecDepartment,
} from "@/lib/admission/ensure-records";

const PROGRAM_TYPES = [
  "language_program",
  "associate_2yr",
  "bachelor_3yr_extension",
  "bachelor_4yr",
] as const;

const SPEC_AREAS = [
  "departments",
  "required_documents",
  "eligibility",
  "schedule",
  "tuition",
  "scholarships",
  "metadata",
] as const;

const metaSchema = z
  .object({
    university_id: z.coerce.number().int().positive().optional().nullable(),
    new_university_name_ko: z.string().max(200).optional().nullable(),
    term: z.string().regex(/^\d{4}-(Spring|Fall|Summer|Winter|Year)$/),
    admission_category: z.string().max(200).optional().nullable(),
    program_type: z.enum(PROGRAM_TYPES),
    source_file_url: z.string().max(500).optional().nullable(),
  })
  .refine(
    (d) =>
      d.university_id != null ||
      (d.new_university_name_ko != null &&
        d.new_university_name_ko.trim() !== ""),
    {
      message: "대학을 선택하거나 신규 대학명을 입력하세요",
      path: ["university_id"],
    }
  );

export type ApproveSpecState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      /** 같은 대학+학기 승인본이 이미 있어 갱신 확인이 필요 */
      duplicate?: { count: number; term: string };
    }
  | undefined;

export async function approveSpecAction(
  _prev: ApproveSpecState,
  formData: FormData
): Promise<ApproveSpecState> {
  const supabase = await createClient();

  // 1. 운영자 인증 (현재 사용자의 role 확인)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  // 2. 메타 검증
  const metaRaw = {
    university_id: formData.get("university_id") || null,
    new_university_name_ko: formData.get("new_university_name_ko") || null,
    term: formData.get("term"),
    admission_category: formData.get("admission_category") || null,
    program_type: formData.get("program_type"),
    source_file_url: formData.get("source_file_url") || null,
  };
  const metaParsed = metaSchema.safeParse(metaRaw);
  if (!metaParsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of metaParsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const meta = metaParsed.data;

  // 3. JSON 영역 7개 parse
  const jsonAreas: Record<string, unknown> = {};
  for (const area of SPEC_AREAS) {
    const raw = formData.get(`spec_${area}`);
    if (typeof raw !== "string" || raw.trim() === "") {
      // 빈 영역 default
      jsonAreas[area] =
        area === "departments" ||
        area === "required_documents" ||
        area === "scholarships"
          ? []
          : {};
      continue;
    }
    try {
      jsonAreas[area] = JSON.parse(raw);
    } catch (e) {
      return {
        fieldErrors: {
          [`spec_${area}`]: `JSON parse 실패: ${e instanceof Error ? e.message : String(e)}`,
        },
      };
    }
  }

  // ai_extraction_log JSON (extract.ts 결과)
  let aiLog: unknown = null;
  const aiLogRaw = formData.get("ai_extraction_log");
  if (typeof aiLogRaw === "string" && aiLogRaw.trim()) {
    try {
      aiLog = JSON.parse(aiLogRaw);
    } catch {
      aiLog = { raw: aiLogRaw };
    }
  }

  // 4. 대학/학과 마스터 레코드 확정 (Flow A — 미등록은 active=false 자동 생성)
  const ensured = await ensureUniversityAndDepartments({
    universityId: meta.university_id ?? null,
    newUniversityNameKo: meta.new_university_name_ko ?? null,
    programType: meta.program_type,
    departments: (jsonAreas.departments as SpecDepartment[]) ?? [],
  });
  if (!ensured.ok) {
    return { error: ensured.error };
  }
  const universityId = ensured.result.universityId;

  // 4-1. 중복 승인 보호 — 같은 (대학, 학기) 승인본이 이미 있으면
  //   바로 덮어쓰지 않고 운영자에게 "갱신할까요?" 확인을 받는다.
  //   confirm_replace=true 로 다시 제출해야만 기존을 보관(archived) 처리.
  const confirmReplace = formData.get("confirm_replace") === "true";
  const { data: existingApproved, error: dupErr } = await supabase
    .from("study_admission_specs")
    .select("id")
    .eq("university_id", universityId)
    .eq("term", meta.term)
    .eq("status", "approved");
  if (dupErr) {
    return { error: `중복 확인 실패: ${dupErr.message}` };
  }
  const dupCount = existingApproved?.length ?? 0;

  if (dupCount > 0 && !confirmReplace) {
    // 아직 확인 전 — 저장하지 않고 확인 요청 반환
    return { duplicate: { count: dupCount, term: meta.term } };
  }

  if (dupCount > 0 && confirmReplace) {
    // 갱신 확정 — 기존 승인본 보관 처리 후 새로 저장
    const { error: archiveErr } = await supabase
      .from("study_admission_specs")
      .update({ status: "archived" })
      .eq("university_id", universityId)
      .eq("term", meta.term)
      .eq("status", "approved");
    if (archiveErr) {
      return { error: `기존 승인본 보관 처리 실패: ${archiveErr.message}` };
    }
  }

  // 4-2. 온라인 접수 + 가이드 문서 업로드 (선택)
  const isOnline = formData.get("is_online_submission") === "on";
  const onlineFormUrlRaw = formData.get("online_form_url");
  const onlineFormUrl =
    isOnline && typeof onlineFormUrlRaw === "string" && onlineFormUrlRaw.trim()
      ? onlineFormUrlRaw.trim()
      : null;
  let onlineGuideUrl: string | null = null;
  const guideB64 = formData.get("guide_base64");
  if (isOnline && typeof guideB64 === "string" && guideB64.trim() !== "") {
    const guideName = String(formData.get("guide_name") ?? "guide");
    const guideType = String(formData.get("guide_type") ?? "application/octet-stream");
    const safe = guideName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);
    const path = `admission-guides/${universityId}/${Date.now()}_${safe}`;
    const buffer = Buffer.from(guideB64, "base64");
    const { error: upErr } = await supabase.storage
      .from("admission-form-files")
      .upload(path, buffer, { contentType: guideType, upsert: false });
    if (upErr) return { error: `가이드 업로드 실패: ${upErr.message}` };
    onlineGuideUrl = supabase.storage
      .from("admission-form-files")
      .getPublicUrl(path).data.publicUrl;
  }

  // 5. INSERT
  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabase
    .from("study_admission_specs")
    .insert({
      university_id: universityId,
      term: meta.term,
      admission_category: meta.admission_category,
      program_type: meta.program_type,
      departments: jsonAreas.departments,
      required_documents: jsonAreas.required_documents,
      eligibility: jsonAreas.eligibility,
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

  if (insertErr || !inserted) {
    return {
      error: `DB INSERT 실패: ${insertErr?.message ?? "unknown"}`,
    };
  }

  revalidatePath("/admissions");
  if (ensured.result.createdUniversity) revalidatePath("/universities");
  if (ensured.result.createdDepartments.length > 0) {
    revalidatePath("/departments");
    revalidatePath(`/universities/${universityId}`);
  }
  redirect(`/admissions/specs/${inserted.id}`);
}
