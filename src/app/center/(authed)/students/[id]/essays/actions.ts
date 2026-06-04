"use server";

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { generateEssayDraft } from "@/lib/admission/generate-essay";
import type { EssayQuestion } from "@/types/study";

export type GenerateEssayResult =
  | { ok: true; generated_text: string }
  | { ok: false; error: string };

/**
 * 특정 학생·양식·질문에 대한 AI 작문 생성 후 저장.
 */
export async function generateEssayAction(input: {
  studentId: string;
  formFileId: string;
  questionIndex: number;
}): Promise<GenerateEssayResult> {
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();

  // 1. 학생 확인 (RLS)
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name")
    .eq("id", input.studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "학생을 찾을 수 없습니다" };

  // 2. 양식 + 질문
  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select("id, essay_questions, name_ko")
    .eq("id", input.formFileId)
    .maybeSingle();
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다" };

  const questions = (form.essay_questions ?? []) as EssayQuestion[];
  const q = questions[input.questionIndex];
  if (!q) return { ok: false, error: "질문 인덱스가 유효하지 않습니다" };

  // 3. 학생의 basis 데이터 수집
  const basisKeys = q.basis_data_type_keys ?? [];
  let basisFacts: Array<{ label_ko: string; value: string }> = [];

  if (basisKeys.length > 0) {
    const [{ data: values }, { data: types }] = await Promise.all([
      supabase
        .from("study_student_data_values")
        .select("data_type_key, value")
        .eq("student_id", input.studentId)
        .in("data_type_key", basisKeys),
      supabase
        .from("study_student_data_types")
        .select("key, label_ko")
        .in("key", basisKeys),
    ]);
    const labelMap = new Map(
      (types ?? []).map((t) => [t.key, t.label_ko])
    );
    basisFacts = (values ?? [])
      .map((v) => {
        const label = labelMap.get(v.data_type_key) ?? v.data_type_key;
        const valStr =
          typeof v.value === "string"
            ? v.value
            : v.value === null || v.value === undefined
              ? ""
              : JSON.stringify(v.value);
        return { label_ko: label, value: valStr };
      })
      .filter((f) => f.value.trim() !== "");
  }

  // 4. Claude 호출
  const result = await generateEssayDraft({
    questionKo: q.question_ko,
    questionVi: q.question_vi,
    maxChars: q.max_chars,
    basisFacts,
    studentName: student.name,
  });

  if (!result.ok) return result;

  // 5. 결과 upsert
  const nowIso = new Date().toISOString();
  const { error: saveErr } = await supabase
    .from("study_student_essay_drafts")
    .upsert(
      {
        student_id: input.studentId,
        form_file_id: input.formFileId,
        question_index: input.questionIndex,
        question_ko: q.question_ko,
        basis_data_keys: basisKeys,
        generated_text: result.generated_text,
        generated_at: nowIso,
        generation_model: result.model,
        generation_usage: result.usage,
      },
      { onConflict: "student_id,form_file_id,question_index" }
    );
  if (saveErr) return { ok: false, error: `저장 실패: ${saveErr.message}` };

  revalidatePath(`/center/students/${input.studentId}/essays`);
  return { ok: true, generated_text: result.generated_text };
}

/**
 * 작문 결과 수동 편집 저장.
 */
export async function saveEssayEditAction(input: {
  draftId: string;
  studentId: string;
  editedText: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();

  const { error } = await supabase
    .from("study_student_essay_drafts")
    .update({
      edited_text: input.editedText,
      edited_at: new Date().toISOString(),
      edited_by: session.authUserId,
    })
    .eq("id", input.draftId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/center/students/${input.studentId}/essays`);
  return { ok: true };
}
