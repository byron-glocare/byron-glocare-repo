/**
 * GET /center/students/[id]/forms/[formFileId]/hwpx
 *
 * 학생 × 양식 작성 시트를 HWPX 파일로 다운로드 (B4-8).
 * 한컴오피스 또는 네이버 한컴독스에서 열어 편집/인쇄 가능.
 */

import { type NextRequest } from "next/server";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { buildSheetHwpx } from "@/lib/admission/build-form-sheet";
import type { EssayQuestion } from "@/types/study";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; formFileId: string }> }
) {
  await verifyCenterSession();
  const { id, formFileId } = await params;
  const supabase = await createCenterClient();

  const [{ data: student }, { data: form }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id, name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("study_admission_form_files")
      .select("*")
      .eq("id", formFileId)
      .maybeSingle(),
  ]);

  if (!student || !form) {
    return new Response("Not Found", { status: 404 });
  }

  const { data: uni } = await supabase
    .from("universities")
    .select("id, name_ko")
    .eq("id", form.university_id)
    .maybeSingle();

  const requiredKeys = form.required_data_type_keys ?? [];
  const essayQuestions = (form.essay_questions ?? []) as EssayQuestion[];

  const allKeys = new Set<string>(requiredKeys);
  for (const q of essayQuestions) {
    for (const k of q.basis_data_type_keys ?? []) allKeys.add(k);
  }
  const keysArr = Array.from(allKeys);

  const [{ data: types }, { data: values }, { data: drafts }] =
    await Promise.all([
      keysArr.length > 0
        ? supabase
            .from("study_student_data_types")
            .select("key, label_ko, category, input_type")
            .in("key", keysArr)
        : Promise.resolve({
            data: [] as Array<{
              key: string;
              label_ko: string;
              category: string;
              input_type: string;
            }>,
          }),
      keysArr.length > 0
        ? supabase
            .from("study_student_data_values")
            .select("data_type_key, value")
            .eq("student_id", id)
            .in("data_type_key", keysArr)
        : Promise.resolve({
            data: [] as Array<{ data_type_key: string; value: Json }>,
          }),
      essayQuestions.length > 0
        ? supabase
            .from("study_student_essay_drafts")
            .select("question_index, generated_text, edited_text")
            .eq("student_id", id)
            .eq("form_file_id", formFileId)
        : Promise.resolve({
            data: [] as Array<{
              question_index: number;
              generated_text: string | null;
              edited_text: string | null;
            }>,
          }),
    ]);

  const valueMap = new Map<string, Json>(
    (values ?? []).map((v) => [v.data_type_key, v.value])
  );
  const typeMap = new Map((types ?? []).map((t) => [t.key, t]));

  // requiredKeys 순서로 (essay basis 만 쓰이는 키는 제외 — 표에 잡음)
  const fields = requiredKeys
    .map((k) => {
      const t = typeMap.get(k);
      if (!t) return null;
      return {
        key: k,
        label_ko: t.label_ko,
        category: t.category,
        input_type: t.input_type,
        value: valueMap.get(k),
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  let hwpxBytes: Uint8Array;
  try {
    hwpxBytes = await buildSheetHwpx({
      studentName: student.name,
      formName: form.name_ko,
      universityNameKo: uni?.name_ko ?? "?",
      departmentName: form.department_name,
      fields,
      essayQuestions,
      drafts: (drafts ?? []).map((d) => ({
        question_index: d.question_index,
        generated_text: d.generated_text,
        edited_text: d.edited_text,
      })),
    });
  } catch (e) {
    return new Response(
      `HWPX 생성 실패: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 }
    );
  }

  const fileName = `${student.name}_${form.name_ko}.hwpx`.replace(
    /[/\\?%*:|"<>]/g,
    "_"
  );

  // RFC 5987 filename* 로 한국어 파일명 안전 전달
  const encodedName = encodeURIComponent(fileName);

  // Uint8Array → Buffer (Node Response body 호환)
  return new Response(Buffer.from(hwpxBytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.hancom.hwpx",
      "Content-Disposition": `attachment; filename="sheet.hwpx"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
