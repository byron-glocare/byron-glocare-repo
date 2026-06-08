"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  callAnalyzeForm,
  type SuggestedMissingDataType,
  type EssaySubQuestion,
} from "@/lib/admission/call-analyze-form";
import type {
  StudyAdmissionFormFileInsert,
} from "@/types/database";

const FORM_KEYS = [
  "application_form",
  "self_intro",
  "study_plan",
  "financial_pledge_form",
  "privacy_consent",
  "academic_record_release",
  "recommendation_letter",
  "health_certificate",
  "other",
] as const;

const BUCKET = "admission-form-files";
const MAX_SIZE = 30 * 1024 * 1024; // 30MB

const uploadSchema = z.object({
  university_id: z.coerce.number().int().positive(),
  department_name: z.string().max(200).nullable(),
  key: z.enum(FORM_KEYS),
  name_ko: z.string().min(1).max(500),
  notes: z.string().max(1000).nullable(),
  file_base64: z.string().min(1),
  file_name: z.string().min(1).max(300),
  file_size: z.coerce.number().int().positive(),
  mime_type: z.string().max(200).optional(),
  required_data_type_keys: z.array(z.string()).default([]),
  auto_analyze: z.boolean().default(true),
});

export type UploadFormFileState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      /** AI 분석 자동 실행 결과 메모 */
      analyzeNotes?: string;
      /** 자동 추출된 데이터 키 개수 */
      analyzedKeys?: number;
      /** 자동 추출된 essay 질문 개수 */
      analyzedQuestions?: number;
      /** AI 가 제안한 신규 카탈로그 항목 — 운영자가 1클릭 추가 가능 */
      missingDataTypes?: SuggestedMissingDataType[];
    }
  | undefined;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot >= 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot >= 0 ? name.slice(lastDot) : "";
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
  return safe + ext;
}

export async function uploadFormFileAction(
  _prev: UploadFormFileState,
  formData: FormData
): Promise<UploadFormFileState> {
  // 1. 사용자 확인 (user JWT 로)
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  // 2. 이후 모든 작업은 service role (RLS 우회 — 어드민 전용 기능)
  const supabase = createAdminClient();

  let requiredKeys: string[] = [];
  const keysRaw = formData.get("required_data_type_keys");
  if (typeof keysRaw === "string" && keysRaw.trim()) {
    try {
      const parsed = JSON.parse(keysRaw);
      if (Array.isArray(parsed)) {
        requiredKeys = parsed.filter(
          (k): k is string => typeof k === "string"
        );
      }
    } catch {
      // 무시
    }
  }

  const autoAnalyze =
    formData.get("auto_analyze") !== "off" &&
    formData.get("auto_analyze") !== "false";

  const raw = {
    university_id: formData.get("university_id"),
    department_name: emptyToNull(formData.get("department_name")),
    key: formData.get("key"),
    name_ko: formData.get("name_ko"),
    notes: emptyToNull(formData.get("notes")),
    file_base64: formData.get("file_base64"),
    file_name: formData.get("file_name"),
    file_size: formData.get("file_size"),
    mime_type: formData.get("mime_type") ?? undefined,
    required_data_type_keys: requiredKeys,
    auto_analyze: autoAnalyze,
  };

  const parsed = uploadSchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  if (data.file_size > MAX_SIZE) {
    return {
      error: `파일이 너무 큽니다 (${(data.file_size / 1024 / 1024).toFixed(1)}MB > 30MB)`,
    };
  }

  // 3. Storage 업로드
  const buffer = Buffer.from(data.file_base64, "base64");
  const safeName = sanitizeFileName(data.file_name);
  const path = `${data.university_id}/${data.key}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: data.mime_type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    return { error: `Storage 업로드 실패: ${upErr.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // 4. 기존 row archive
  let archiveQuery = supabase
    .from("study_admission_form_files")
    .update({ is_current: false })
    .eq("university_id", data.university_id)
    .eq("key", data.key)
    .eq("is_current", true);
  if (data.department_name === null) {
    archiveQuery = archiveQuery.is("department_name", null);
  } else {
    archiveQuery = archiveQuery.eq("department_name", data.department_name);
  }
  const { error: archErr } = await archiveQuery;
  if (archErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `기존 양식 archive 실패: ${archErr.message}` };
  }

  // 5. AI 자동 분석 (옵션) — 업로드와 한 흐름으로
  let analyzeNotes: string | undefined;
  let analyzedKeys = 0;
  let analyzedQuestions = 0;
  let missingDataTypes: SuggestedMissingDataType[] = [];
  let mergedRequiredKeys = data.required_data_type_keys;
  let essayQuestions: Array<{
    question_ko: string;
    question_vi?: string;
    max_chars?: number;
    basis_data_type_keys: string[];
    sub_questions: EssaySubQuestion[];
  }> = [];

  if (data.auto_analyze) {
    // 카탈로그 가져오기
    const { data: types } = await supabase
      .from("study_student_data_types")
      .select("key, label_ko, category, is_essay_basis, aliases, is_derived")
      .eq("is_active", true)
      .order("sort_order");

    const result = await callAnalyzeForm({
      fileUrl: publicUrl,
      fileName: data.file_name,
      availableDataTypes: (types ?? []).map((t) => ({
        key: t.key,
        label_ko: t.label_ko,
        category: t.category,
        is_essay_basis: t.is_essay_basis,
        aliases: t.aliases ?? [],
        is_derived: t.is_derived ?? false,
      })),
    });

    if (result.ok) {
      const merged = new Set(data.required_data_type_keys);
      for (const k of result.suggested_required_data_keys) merged.add(k);
      mergedRequiredKeys = Array.from(merged);
      essayQuestions = result.essay_questions.map((q) => ({
        question_ko: q.question_ko,
        max_chars: q.max_chars,
        basis_data_type_keys: q.basis_data_type_keys,
        sub_questions: q.sub_questions ?? [],
      }));
      missingDataTypes = result.missing_data_types ?? [];
      analyzedKeys = result.suggested_required_data_keys.length;
      analyzedQuestions = result.essay_questions.length;
      analyzeNotes =
        result.analysis_notes ||
        `AI 가 ${analyzedQuestions}개 서술형 질문 + ${analyzedKeys}개 필요 데이터 키를 자동 추출했습니다.${
          missingDataTypes.length > 0
            ? ` 카탈로그 누락 ${missingDataTypes.length}개 발견.`
            : ""
        }`;
    } else {
      analyzeNotes = `AI 자동 분석 실패: ${result.error} (수동으로 essay-questions 편집 가능)`;
    }
  }

  // 6. 새 row INSERT (AI 결과 포함)
  const ins: StudyAdmissionFormFileInsert = {
    university_id: data.university_id,
    department_name: data.department_name,
    key: data.key,
    name_ko: data.name_ko,
    file_url: publicUrl,
    file_name: data.file_name,
    size_bytes: data.file_size,
    mime_type: data.mime_type ?? null,
    is_current: true,
    uploaded_by: user.id,
    notes: data.notes,
    required_data_type_keys: mergedRequiredKeys,
    essay_questions: essayQuestions,
  };
  const { error: insErr } = await supabase
    .from("study_admission_form_files")
    .insert(ins);
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `DB 저장 실패: ${insErr.message}` };
  }

  revalidatePath(`/universities/${data.university_id}/forms`);
  revalidatePath("/admissions");
  revalidatePath(`/admissions/${data.university_id}`);
  return {
    analyzeNotes,
    analyzedKeys,
    analyzedQuestions,
    missingDataTypes,
  };
}

/**
 * AI 가 제안한 누락 데이터 타입을 카탈로그에 1클릭 추가 (B4-9 — forms 폴더 export).
 *   essay-questions/actions.ts 의 addSuggestedDataTypeAction 과 동일 로직.
 *   업로드 success notice 에서 호출.
 */
export type AddDataTypeFromUploadResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

export async function addSuggestedDataTypeFromUploadAction(
  suggestion: SuggestedMissingDataType
): Promise<AddDataTypeFromUploadResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  const { data: maxRow } = await supabase
    .from("study_student_data_types")
    .select("sort_order")
    .eq("category", suggestion.category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? 0) + 10;

  const { error } = await supabase
    .from("study_student_data_types")
    .insert({
      key: suggestion.key,
      label_ko: suggestion.label_ko,
      label_vi: suggestion.label_vi,
      category: suggestion.category,
      input_type: suggestion.input_type,
      hint_ko: suggestion.hint_ko ?? null,
      hint_vi: null,
      is_essay_basis: suggestion.category === "essay",
      is_default_required: false,
      is_active: true,
      sort_order: sortOrder,
    });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `이미 존재: ${suggestion.key}` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/student-data-types");
  return { ok: true, key: suggestion.key };
}

/**
 * 양식 메타데이터 수정 (업로드 이후 표시명·종류·적용범위·메모·필요데이터 편집).
 *   파일 자체는 재업로드로 교체 (버전 관리). 여기서는 메타만 수정.
 *
 *   적용범위(department_name) 또는 양식종류(key) 변경 = scope 변경:
 *     - 같은 (대학, 새 key, 새 학과) 에 이미 다른 current 양식이 있으면 충돌 → 거부.
 *     - 버전 그룹핑이 (university_id, key, department_name) 기준이므로
 *       이전 버전(archive)까지 같은 그룹 전체에 cascade.
 */
const updateMetaSchema = z.object({
  form_file_id: z.string().uuid(),
  university_id: z.coerce.number().int().positive(),
  key: z.enum(FORM_KEYS),
  department_name: z.string().max(200).nullable(),
  name_ko: z.string().min(1).max(500),
  notes: z.string().max(1000).nullable(),
  required_data_type_keys: z.array(z.string()).default([]),
});

export type UpdateFormFileMetaState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      success?: boolean;
    }
  | undefined;

export async function updateFormFileMetaAction(
  _prev: UpdateFormFileMetaState,
  formData: FormData
): Promise<UpdateFormFileMetaState> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  let requiredKeys: string[] = [];
  const keysRaw = formData.get("required_data_type_keys");
  if (typeof keysRaw === "string" && keysRaw.trim()) {
    try {
      const parsed = JSON.parse(keysRaw);
      if (Array.isArray(parsed)) {
        requiredKeys = parsed.filter((k): k is string => typeof k === "string");
      }
    } catch {
      // 무시
    }
  }

  const parsed = updateMetaSchema.safeParse({
    form_file_id: formData.get("form_file_id"),
    university_id: formData.get("university_id"),
    key: formData.get("key"),
    department_name: emptyToNull(formData.get("department_name")),
    name_ko: formData.get("name_ko"),
    notes: emptyToNull(formData.get("notes")),
    required_data_type_keys: requiredKeys,
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  // 대상 row 조회
  const { data: orig, error: origErr } = await supabase
    .from("study_admission_form_files")
    .select("id, university_id, key, department_name")
    .eq("id", data.form_file_id)
    .maybeSingle();
  if (origErr || !orig) return { error: "양식을 찾을 수 없습니다" };
  if (orig.university_id !== data.university_id) {
    return { error: "대학교 정보가 일치하지 않습니다" };
  }

  const scopeChanged =
    orig.key !== data.key || (orig.department_name ?? null) !== data.department_name;

  if (scopeChanged) {
    // 1) 기존 버전 체인 id 수집 (원래 그룹)
    let chainQuery = supabase
      .from("study_admission_form_files")
      .select("id")
      .eq("university_id", orig.university_id)
      .eq("key", orig.key);
    chainQuery =
      orig.department_name === null
        ? chainQuery.is("department_name", null)
        : chainQuery.eq("department_name", orig.department_name);
    const { data: chainRows } = await chainQuery;
    const chainIds = new Set((chainRows ?? []).map((r) => r.id));

    // 2) 새 그룹에 다른 current 양식이 있는지 충돌 검사
    let collideQuery = supabase
      .from("study_admission_form_files")
      .select("id")
      .eq("university_id", data.university_id)
      .eq("key", data.key)
      .eq("is_current", true);
    collideQuery =
      data.department_name === null
        ? collideQuery.is("department_name", null)
        : collideQuery.eq("department_name", data.department_name);
    const { data: collideRows } = await collideQuery;
    const conflict = (collideRows ?? []).some((r) => !chainIds.has(r.id));
    if (conflict) {
      const scopeLabel = data.department_name ?? "대학 전체";
      return {
        error: `이미 "${scopeLabel}" 범위에 같은 종류의 양식이 있습니다. 먼저 기존 양식을 삭제하거나 다른 범위를 선택하세요.`,
      };
    }

    // 3) 그룹 전체 cascade (이전 버전까지 key/department 동기화)
    const { error: cascadeErr } = await supabase
      .from("study_admission_form_files")
      .update({ key: data.key, department_name: data.department_name })
      .in("id", Array.from(chainIds));
    if (cascadeErr) {
      return { error: `적용범위 변경 실패: ${cascadeErr.message}` };
    }
  }

  // 4) 현재 row 메타 수정
  const { error: updErr } = await supabase
    .from("study_admission_form_files")
    .update({
      name_ko: data.name_ko,
      notes: data.notes,
      required_data_type_keys: data.required_data_type_keys,
    })
    .eq("id", data.form_file_id);
  if (updErr) {
    return { error: `수정 실패: ${updErr.message}` };
  }

  revalidatePath(`/universities/${data.university_id}/forms`);
  revalidatePath("/admissions");
  revalidatePath(`/admissions/${data.university_id}`);
  return { success: true };
}

/**
 * 양식 삭제 (현재 + 모든 이전 버전 + Storage 파일).
 */
export async function deleteFormFileAction(
  formFileId: string,
  universityId: number
): Promise<void> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return;
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("study_admission_form_files")
    .select("university_id, department_name, key")
    .eq("id", formFileId)
    .maybeSingle();
  if (!row) return;

  let query = supabase
    .from("study_admission_form_files")
    .select("id, file_url")
    .eq("university_id", row.university_id)
    .eq("key", row.key);
  if (row.department_name === null) {
    query = query.is("department_name", null);
  } else {
    query = query.eq("department_name", row.department_name);
  }
  const { data: allVersions } = await query;

  const paths: string[] = [];
  for (const v of allVersions ?? []) {
    const m = v.file_url.match(/admission-form-files\/(.+)$/);
    if (m) paths.push(m[1]);
  }
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  let delQuery = supabase
    .from("study_admission_form_files")
    .delete()
    .eq("university_id", row.university_id)
    .eq("key", row.key);
  if (row.department_name === null) {
    delQuery = delQuery.is("department_name", null);
  } else {
    delQuery = delQuery.eq("department_name", row.department_name);
  }
  await delQuery;

  revalidatePath(`/universities/${universityId}/forms`);
  revalidatePath("/admissions");
  revalidatePath(`/admissions/${universityId}`);
}

/**
 * archive 된 버전 복원.
 */
export async function restoreFormFileAction(
  formFileId: string,
  universityId: number
): Promise<void> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return;
  const supabase = createAdminClient();

  const { data: target } = await supabase
    .from("study_admission_form_files")
    .select("university_id, department_name, key, is_current")
    .eq("id", formFileId)
    .maybeSingle();
  if (!target || target.is_current) return;

  let archiveQuery = supabase
    .from("study_admission_form_files")
    .update({ is_current: false })
    .eq("university_id", target.university_id)
    .eq("key", target.key)
    .eq("is_current", true);
  if (target.department_name === null) {
    archiveQuery = archiveQuery.is("department_name", null);
  } else {
    archiveQuery = archiveQuery.eq("department_name", target.department_name);
  }
  await archiveQuery;

  await supabase
    .from("study_admission_form_files")
    .update({ is_current: true })
    .eq("id", formFileId);

  revalidatePath(`/universities/${universityId}/forms`);
  revalidatePath("/admissions");
  revalidatePath(`/admissions/${universityId}`);
}
