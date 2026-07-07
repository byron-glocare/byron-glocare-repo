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

  // 4. AI 자동 분석 (옵션) — 업로드와 한 흐름으로.
  //    ⚠ DB 변경(archive/insert)은 분석 *후* 한 번에 — 분석에 30~60초 걸리는데
  //    그 사이 "현행 양식 0개" 구간이 생기지 않도록(archive→insert 를 연속 실행).
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

  // 5. 기존 현행 양식 archive (분석 완료 후 — insert 직전에 실행해 공백 최소화)
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
  const { data: archivedRows, error: archErr } = await archiveQuery.select("id");
  if (archErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `기존 양식 archive 실패: ${archErr.message}` };
  }
  const archivedIds = (archivedRows ?? []).map((r) => r.id);

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
    // 롤백: 방금 archive 한 기존 현행본을 되돌려 "현행 0개" 상태를 막는다.
    if (archivedIds.length > 0) {
      await supabase
        .from("study_admission_form_files")
        .update({ is_current: true })
        .in("id", archivedIds);
    }
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
 * [작성서류 상세] 이미 등록된 양식을 대상으로 AI 표준데이터 맵핑 재실행.
 *   업로드 시의 auto_analyze 와 동일한 callAnalyzeForm 을 원본 파일에 다시 돌려
 *   "필요 표준데이터" 후보 + 누락 카탈로그 + 서술형 문항 수를 반환한다.
 *   ⚠ 결과는 저장하지 않는다 — 운영자가 검토 후 mergeRequiredKeysAction 으로 반영.
 */
export type ReanalyzeFormResult =
  | {
      ok: true;
      suggestedKeys: Array<{ key: string; label_ko: string; already: boolean }>;
      missingDataTypes: SuggestedMissingDataType[];
      essayQuestionCount: number;
      notes: string;
    }
  | { ok: false; error: string };

export async function reanalyzeFormAction(
  formFileId: string
): Promise<ReanalyzeFormResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select("file_url, file_name, required_data_type_keys")
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다." };

  const { data: types } = await supabase
    .from("study_student_data_types")
    .select("key, label_ko, category, is_essay_basis, aliases, is_derived")
    .eq("is_active", true)
    .order("sort_order");

  const result = await callAnalyzeForm({
    fileUrl: form.file_url,
    fileName: form.file_name,
    availableDataTypes: (types ?? []).map((t) => ({
      key: t.key,
      label_ko: t.label_ko,
      category: t.category,
      is_essay_basis: t.is_essay_basis,
      aliases: t.aliases ?? [],
      is_derived: t.is_derived ?? false,
    })),
  });
  if (!result.ok) return { ok: false, error: result.error };

  const labelByKey = new Map((types ?? []).map((t) => [t.key, t.label_ko]));
  const existing = new Set(form.required_data_type_keys ?? []);
  const suggestedKeys = result.suggested_required_data_keys.map((k) => ({
    key: k,
    label_ko: labelByKey.get(k) ?? k,
    already: existing.has(k),
  }));

  return {
    ok: true,
    suggestedKeys,
    missingDataTypes: result.missing_data_types ?? [],
    essayQuestionCount: result.essay_questions.length,
    notes: result.analysis_notes || "",
  };
}

/**
 * [작성서류 상세] AI 재분석에서 고른 표준데이터 키를 required 에 병합(합집합) 저장.
 *   기존 required 를 지우지 않고 추가만 한다. (기본정보 저장은 required 를 건드리지 않으므로 안전.)
 */
export type MergeRequiredKeysResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

export async function mergeRequiredKeysAction(
  formFileId: string,
  keys: string[]
): Promise<MergeRequiredKeysResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select("required_data_type_keys, university_id")
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다." };

  const merged = Array.from(
    new Set([...(form.required_data_type_keys ?? []), ...keys])
  );
  const { error } = await supabase
    .from("study_admission_form_files")
    .update({ required_data_type_keys: merged })
    .eq("id", formFileId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admissions/forms/${formFileId}`);
  revalidatePath(`/universities/${form.university_id}/forms`);
  return { ok: true, count: merged.length };
}

/**
 * [작성서류 상세] AI 재분석 '처음부터 다시' 모드 — required 를 선택 키로 통째로 교체.
 *   기존에 사람이 넣은 required 도 여기서 지워진다(선택한 것만 남음). merge 와 달리 합집합이 아님.
 */
export async function replaceRequiredKeysAction(
  formFileId: string,
  keys: string[]
): Promise<MergeRequiredKeysResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select("university_id")
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다." };

  const unique = Array.from(new Set(keys));
  const { error } = await supabase
    .from("study_admission_form_files")
    .update({ required_data_type_keys: unique })
    .eq("id", formFileId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admissions/forms/${formFileId}`);
  revalidatePath(`/universities/${form.university_id}/forms`);
  return { ok: true, count: unique.length };
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
 * [작성서류] 상세 — 단일 row 메타 저장.
 *   적용학과/학기(복수, 신규 컬럼) + 서류명·양식종류·필요데이터·메모.
 *   (대학 이동·버전체인은 다루지 않음 — 단순 per-row 업데이트.)
 */
export type UpdateFormDetailState =
  | { error?: string; success?: boolean }
  | undefined;

export async function updateFormFileDetailAction(
  _prev: UpdateFormDetailState,
  formData: FormData
): Promise<UpdateFormDetailState> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };
  const supabase = createAdminClient();

  const id = String(formData.get("form_file_id") ?? "");
  if (!id) return { error: "대상 양식이 없습니다" };

  const name_ko = String(formData.get("name_ko") ?? "").trim();
  if (!name_ko) return { error: "서류명을 입력하세요" };

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw || null;

  const parseStrArr = (name: string): string[] => {
    const raw = formData.get(name);
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };

  const applies_to_terms = parseStrArr("applies_to_terms");
  const applies_to_department_ids = parseStrArr("applies_to_department_ids")
    .map(Number)
    .filter((n) => Number.isFinite(n));

  // 양식 종류(key)·필요 표준데이터(required_data_type_keys)는 여기서 건드리지 않는다.
  //   key=생성 시 고정 / reqKeys=문서 자동화 설정의 좌표 저장에서 자동 도출.
  const { error } = await supabase
    .from("study_admission_form_files")
    .update({
      name_ko,
      notes,
      applies_to_terms,
      applies_to_department_ids,
    })
    .eq("id", id);
  if (error) return { error: `저장 실패: ${error.message}` };

  revalidatePath(`/admissions/forms/${id}`);
  revalidatePath("/admissions");
  return { success: true };
}

/**
 * [작성서류] PDF 좌표 오버레이 저장 — 원본 양식 위 학생 데이터 채움 위치.
 *   field_overlays = [{key,page,x,y,size?,maxWidth?}] (PDF 포인트, 좌하단 원점).
 */
export type SaveFieldOverlaysResult =
  | { ok: true }
  | { ok: false; error: string };

type OverlayKind = "text" | "image" | "signature" | "check";
type OverlaySource = "student" | "input" | "static";
type OverlayInputType = "date" | "text";
type OverlayDatePart = "year" | "month" | "day";

export async function saveFieldOverlaysAction(
  formFileId: string,
  overlays: Array<{
    key: string;
    page: number;
    x: number;
    y: number;
    w?: number;
    h?: number;
    size?: number;
    maxWidth?: number;
    kind?: OverlayKind;
    source?: OverlaySource;
    dataKey?: string;
    inputLabel?: string;
    inputType?: OverlayInputType;
    staticText?: string;
    datePart?: OverlayDatePart;
    matchValue?: string;
  }>
): Promise<SaveFieldOverlaysResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const supabase = createAdminClient();

  // 검증·정규화 (숫자만, 음수 좌표 방지)
  const clean = overlays
    .filter((o) => o && typeof o.key === "string" && o.key.trim())
    .map((o) => {
      const out: {
        key: string;
        page: number;
        x: number;
        y: number;
        w?: number;
        h?: number;
        size?: number;
        maxWidth?: number;
        kind?: OverlayKind;
        source?: OverlaySource;
        dataKey?: string;
        inputLabel?: string;
        inputType?: OverlayInputType;
        staticText?: string;
        datePart?: OverlayDatePart;
        matchValue?: string;
      } = {
        key: o.key,
        page: Math.max(0, Math.round(Number(o.page) || 0)),
        x: Math.max(0, Number(o.x) || 0),
        y: Math.max(0, Number(o.y) || 0),
      };
      if (Number.isFinite(o.w) && (o.w ?? 0) > 0) out.w = Number(o.w);
      if (Number.isFinite(o.h) && (o.h ?? 0) > 0) out.h = Number(o.h);
      if (Number.isFinite(o.size) && (o.size ?? 0) > 0) out.size = Number(o.size);
      if (Number.isFinite(o.maxWidth) && (o.maxWidth ?? 0) > 0)
        out.maxWidth = Number(o.maxWidth);
      if (o.kind && o.kind !== "text") out.kind = o.kind;
      if (o.source === "input" || o.source === "static") out.source = o.source;
      if (typeof o.dataKey === "string" && o.dataKey) out.dataKey = o.dataKey;
      if (typeof o.inputLabel === "string" && o.inputLabel.trim())
        out.inputLabel = o.inputLabel.trim();
      if (o.inputType === "date" || o.inputType === "text")
        out.inputType = o.inputType;
      if (typeof o.staticText === "string" && o.staticText.trim())
        out.staticText = o.staticText;
      if (o.datePart === "year" || o.datePart === "month" || o.datePart === "day")
        out.datePart = o.datePart;
      if (typeof o.matchValue === "string" && o.matchValue.trim())
        out.matchValue = o.matchValue.trim();
      return out;
    });

  // 연결된 박스에서 필요 표준데이터(reqKeys) 자동 도출 (essay: 제외).
  //   → 별도 '필요 표준데이터' 체크 단계 없이, 배치·연결한 박스가 곧 필요 데이터.
  const reqKeys = Array.from(
    new Set(
      clean
        .map((o) => o.dataKey)
        .filter((k): k is string => !!k && !k.startsWith("essay:"))
    )
  );

  const { error } = await supabase
    .from("study_admission_form_files")
    .update({ field_overlays: clean, required_data_type_keys: reqKeys })
    .eq("id", formFileId);
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  revalidatePath(`/admissions/forms/${formFileId}`);
  return { ok: true };
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
