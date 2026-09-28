"use server";

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { generateEssayDraft } from "@/lib/admission/generate-essay";
import type { EssaySection } from "@/types/study";

export type GenerateEssayResult =
  | { ok: true; generated_text: string }
  | { ok: false; error: string };

/**
 * 특정 학생·양식·서술형 섹션에 대한 AI 초안 생성 후 저장.
 *   섹션(essay_sections[index])의 작성지침(prompt)+기반데이터(basis_keys)로 작성.
 */
export async function generateEssayAction(input: {
  studentId: string;
  formFileId: string;
  questionIndex: number;
}): Promise<GenerateEssayResult> {
  const session = await verifyCenterSession();
  void session;
  const supabase = await createCenterClient();

  // 1. 학생 확인 (RLS)
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name, dob, topik_level")
    .eq("id", input.studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "학생을 찾을 수 없습니다" };

  // 2. 양식 + 서술형 섹션
  const { data: form } = await supabase
    .from("study_admission_form_files")
    .select("id, essay_sections, name_ko")
    .eq("id", input.formFileId)
    .maybeSingle();
  if (!form) return { ok: false, error: "양식을 찾을 수 없습니다" };

  const sections = (form.essay_sections ?? []) as EssaySection[];
  const sec = sections[input.questionIndex];
  if (!sec) return { ok: false, error: "서술형 문항을 찾을 수 없습니다" };

  // 3. 학생의 basis 데이터 수집
  const basisKeys = sec.basis_keys ?? [];
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

  // 3-1. 나이·한국어 실력 — 글 수준을 학생에게 맞추려고 넘긴다(대필로 보이지 않게).
  //      학생 기본정보가 비어 있으면 정보 입력 값(birth_date, topik_level)에서 가져온다.
  let dob: string | null = student.dob ?? null;
  let topik: string | number | null = student.topik_level ?? null;
  if (!dob || !topik) {
    const { data: extra } = await supabase
      .from("study_student_data_values")
      .select("data_type_key, value")
      .eq("student_id", input.studentId)
      .in("data_type_key", ["birth_date", "topik_level"]);
    for (const row of extra ?? []) {
      const v = typeof row.value === "string" ? row.value : row.value == null ? "" : String(row.value);
      if (!v.trim()) continue;
      if (row.data_type_key === "birth_date" && !dob) dob = v;
      if (row.data_type_key === "topik_level" && !topik) topik = v;
    }
  }
  const age = ageFromDob(dob);

  // 4. Claude 호출 (작성지침을 질문으로 전달)
  const result = await generateEssayDraft({
    questionKo: sec.prompt?.trim() || sec.label || "서술형 답변",
    basisFacts,
    studentName: student.name,
    studentAge: age,
    topikLevel: topik,
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
        question_ko: sec.label || sec.prompt || "서술형",
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

/** 생년월일(YYYY-MM-DD)에서 만 나이. 못 읽으면 undefined */
function ageFromDob(dob: string | null): number | undefined {
  const m = (dob ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const before = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (before) age -= 1;
  return age > 0 && age < 100 ? age : undefined;
}
