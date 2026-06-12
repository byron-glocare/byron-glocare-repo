/**
 * GET /center/students/[id]/final/docx?form=<formFileId>&app=<applicationId>
 *   학생 데이터를 채운 작성서류를 DOCX 로 생성·다운로드.
 *   파일명: 양식명_이름(영대)_대학_학과_학기.docx
 */

import { type NextRequest } from "next/server";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  buildSheetDocx,
  finalDocFileName,
} from "@/lib/admission/build-form-sheet";
import type { EssayQuestion } from "@/types/study";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifyCenterSession();
  const { id } = await params;
  const formFileId = req.nextUrl.searchParams.get("form") ?? "";
  const appId = req.nextUrl.searchParams.get("app") ?? "";
  const supabase = await createCenterClient();

  const [{ data: student }, { data: form }, { data: app }] = await Promise.all([
    supabase.from("study_managed_students").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("study_admission_form_files").select("*").eq("id", formFileId).maybeSingle(),
    appId
      ? supabase
          .from("study_applications")
          .select("id, admission_spec_id, target_department_label")
          .eq("id", appId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!student || !form) return new Response("Not Found", { status: 404 });

  const [{ data: uni }, { data: spec }] = await Promise.all([
    supabase.from("universities").select("id, name_ko").eq("id", form.university_id).maybeSingle(),
    app
      ? supabase.from("study_admission_specs").select("id, term").eq("id", app.admission_spec_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const requiredKeys = form.required_data_type_keys ?? [];
  const essayQuestions = (form.essay_questions ?? []) as EssayQuestion[];
  const allKeys = new Set<string>(requiredKeys);
  for (const q of essayQuestions)
    for (const k of q.basis_data_type_keys ?? []) allKeys.add(k);
  const keysArr = Array.from(allKeys);

  const [{ data: types }, { data: values }, { data: drafts }] = await Promise.all([
    keysArr.length > 0
      ? supabase.from("study_student_data_types").select("key, label_ko, category, input_type").in("key", keysArr)
      : Promise.resolve({ data: [] as Array<{ key: string; label_ko: string; category: string; input_type: string }> }),
    keysArr.length > 0
      ? supabase.from("study_student_data_values").select("data_type_key, value").eq("student_id", id).in("data_type_key", keysArr)
      : Promise.resolve({ data: [] as Array<{ data_type_key: string; value: Json }> }),
    essayQuestions.length > 0
      ? supabase.from("study_student_essay_drafts").select("question_index, generated_text, edited_text").eq("student_id", id).eq("form_file_id", formFileId)
      : Promise.resolve({ data: [] as Array<{ question_index: number; generated_text: string | null; edited_text: string | null }> }),
  ]);

  const valueMap = new Map<string, Json>((values ?? []).map((v) => [v.data_type_key, v.value]));
  const typeMap = new Map((types ?? []).map((t) => [t.key, t]));
  const fields = requiredKeys
    .map((k) => {
      const t = typeMap.get(k);
      if (!t) return null;
      return { key: k, label_ko: t.label_ko, category: t.category, input_type: t.input_type, value: valueMap.get(k) };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const departmentName = form.department_name ?? app?.target_department_label ?? null;

  let bytes: Uint8Array;
  try {
    bytes = await buildSheetDocx({
      studentName: student.name,
      formName: form.name_ko,
      universityNameKo: uni?.name_ko ?? "?",
      departmentName,
      fields,
      essayQuestions,
      drafts: (drafts ?? []).map((d) => ({
        question_index: d.question_index,
        generated_text: d.generated_text,
        edited_text: d.edited_text,
      })),
    });
  } catch (e) {
    return new Response(`DOCX 생성 실패: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
  }

  const fileName = finalDocFileName({
    docName: form.name_ko,
    studentName: student.name,
    universityNameKo: uni?.name_ko ?? "",
    departmentName,
    term: spec?.term ?? "",
    ext: "docx",
  });
  const encoded = encodeURIComponent(fileName);

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="document.docx"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}
