"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  callAnalyzeForm,
  type SuggestedMissingDataType,
  type EssaySubQuestion,
} from "@/lib/admission/call-analyze-form";
import type { StudyStudentDataTypeInsert } from "@/types/database";

const subQuestionSchema = z.object({
  question_ko: z.string().min(1).max(2000),
  question_vi: z.string().min(1).max(2000),
  hint_vi: z.string().max(1000).optional(),
  data_type_key: z.string().max(100).optional(),
});

const questionSchema = z.object({
  question_ko: z.string().min(1).max(5000),
  question_vi: z.string().max(5000).optional(),
  max_chars: z.coerce.number().int().min(50).max(10000).optional(),
  basis_data_type_keys: z.array(z.string()).default([]),
  sub_questions: z.array(subQuestionSchema).default([]),
});

export type SaveEssayQuestionsState =
  | {
      ok?: boolean;
      error?: string;
    }
  | undefined;

export async function saveEssayQuestionsAction(
  formFileId: string,
  universityId: number,
  _prev: SaveEssayQuestionsState,
  formData: FormData
): Promise<SaveEssayQuestionsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const raw = formData.get("questions");
  if (typeof raw !== "string") {
    return { error: "questions JSON 누락" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      error: `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!Array.isArray(parsed)) {
    return { error: "questions 는 배열이어야 합니다" };
  }

  // 각 질문 검증
  type EssayQuestion = {
    question_ko: string;
    question_vi?: string;
    max_chars?: number;
    basis_data_type_keys: string[];
    sub_questions: EssaySubQuestion[];
  };
  const validated: EssayQuestion[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const r = questionSchema.safeParse(parsed[i]);
    if (!r.success) {
      return {
        error: `질문 #${i + 1} 검증 실패: ${r.error.issues
          .map((x) => x.message)
          .join(", ")}`,
      };
    }
    const cleaned: EssayQuestion = {
      question_ko: r.data.question_ko,
      basis_data_type_keys: r.data.basis_data_type_keys,
      sub_questions: r.data.sub_questions.map((s) => ({
        question_ko: s.question_ko,
        question_vi: s.question_vi,
        ...(s.hint_vi ? { hint_vi: s.hint_vi } : {}),
        ...(s.data_type_key ? { data_type_key: s.data_type_key } : {}),
      })),
    };
    if (r.data.question_vi) cleaned.question_vi = r.data.question_vi;
    if (r.data.max_chars != null) cleaned.max_chars = r.data.max_chars;
    validated.push(cleaned);
  }

  const { error } = await supabase
    .from("study_admission_form_files")
    .update({ essay_questions: validated })
    .eq("id", formFileId);

  if (error) return { error: `DB 저장 실패: ${error.message}` };

  revalidatePath(`/universities/${universityId}/forms`);
  revalidatePath(
    `/universities/${universityId}/forms/${formFileId}/essay-questions`
  );
  return { ok: true };
}

/**
 * 양식 파일을 Claude 로 분석해 essay_questions + required_data_type_keys 자동 추출.
 *   - DB 직접 저장 X (운영자가 검수 후 저장)
 *   - 추출 결과만 반환 → 클라이언트가 폼에 prefill
 */
export type AnalyzeResult =
  | {
      ok: true;
      essay_questions: Array<{
        question_ko: string;
        max_chars?: number;
        basis_data_type_keys: string[];
        sub_questions: EssaySubQuestion[];
      }>;
      suggested_required_data_keys: string[];
      missing_data_types: SuggestedMissingDataType[];
      analysis_notes: string;
    }
  | { ok: false; error: string };

export async function analyzeFormAction(
  formFileId: string
): Promise<AnalyzeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  // 양식 정보
  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select("file_url, file_name")
    .eq("id", formFileId)
    .maybeSingle();
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다" };

  // 활성 카탈로그
  const { data: types } = await supabase
    .from("study_student_data_types")
    .select("key, label_ko, category, is_essay_basis")
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
    })),
  });

  if (!result.ok) return result;

  return {
    ok: true,
    essay_questions: result.essay_questions,
    suggested_required_data_keys: result.suggested_required_data_keys,
    missing_data_types: result.missing_data_types,
    analysis_notes: result.analysis_notes,
  };
}

/**
 * AI 가 제안한 신규 데이터 타입을 카탈로그에 추가 (B4-9).
 *   sort_order 는 같은 카테고리의 max + 10 으로 자동.
 */
export type AddDataTypeResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

export async function addSuggestedDataTypeAction(
  suggestion: SuggestedMissingDataType
): Promise<AddDataTypeResult> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  // 같은 카테고리 max sort_order 조회
  const { data: maxRow } = await supabase
    .from("study_student_data_types")
    .select("sort_order")
    .eq("category", suggestion.category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? 0) + 10;

  const ins: StudyStudentDataTypeInsert = {
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
  };

  const { error } = await supabase
    .from("study_student_data_types")
    .insert(ins);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `이미 존재하는 키: ${suggestion.key}` };
    }
    return { ok: false, error: `DB INSERT 실패: ${error.message}` };
  }

  revalidatePath("/student-data-types");
  return { ok: true, key: suggestion.key };
}

