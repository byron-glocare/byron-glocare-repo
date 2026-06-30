/**
 * /center/students/[id]/essays — 학생의 양식별 서술형 답변 AI 작문 (B4-5).
 *
 * 학생의 지원 의향 → 모집요강 → 적용 양식 → 양식의 essay_questions
 * 각 질문에 대해 AI 작문 생성 / 편집 / 저장.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";
import { EssaysClient } from "./essays-client";
import type { EssaySection } from "@/types/study";

export default async function StudentEssaysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  // 지원 의향 → spec → university → 양식 (essay_questions 있는 것만)
  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, admission_spec_id, target_department_label")
    .eq("student_id", id);

  type FormWithQuestions = {
    form_file_id: string;
    name_ko: string;
    department_name: string | null;
    university_id: number;
    university_name_ko: string;
    essay_sections: EssaySection[];
    /** 어떤 application 들로 인해 이 양식이 필요한가 */
    application_labels: string[];
  };

  const forms: FormWithQuestions[] = [];

  if ((apps ?? []).length > 0) {
    const specIds = (apps ?? []).map((a) => a.admission_spec_id);
    const { data: specs } = await supabase
      .from("study_admission_specs")
      .select("id, university_id")
      .in("id", specIds);

    const specToUni = new Map(
      (specs ?? []).map((s) => [s.id, s.university_id])
    );
    const universityIds = Array.from(
      new Set((specs ?? []).map((s) => s.university_id))
    );

    if (universityIds.length > 0) {
      const [{ data: unis }, { data: formRows }] = await Promise.all([
        supabase
          .from("universities")
          .select("id, name_ko")
          .in("id", universityIds),
        supabase
          .from("study_admission_form_files")
          .select(
            "id, university_id, department_name, name_ko, is_essay, essay_sections"
          )
          .in("university_id", universityIds)
          .eq("is_current", true),
      ]);

      const uniNameMap = new Map(
        (unis ?? []).map((u) => [u.id, u.name_ko])
      );

      // application 의 학과별 필터 → 해당 양식 매칭
      const collectedForms = new Map<string, FormWithQuestions>();
      for (const app of apps ?? []) {
        const uniId = specToUni.get(app.admission_spec_id);
        if (uniId == null) continue;
        const applicable = (formRows ?? []).filter((f) => {
          if (f.university_id !== uniId) return false;
          const secs = (f.essay_sections ?? []) as EssaySection[];
          if (!f.is_essay || secs.length === 0) return false; // 서술형 문서만
          if (f.department_name === null) return true;
          return (
            app.target_department_label &&
            f.department_name === app.target_department_label
          );
        });
        for (const f of applicable) {
          const existing = collectedForms.get(f.id);
          if (existing) {
            const lbl = app.target_department_label ?? "(전체)";
            if (!existing.application_labels.includes(lbl)) {
              existing.application_labels.push(lbl);
            }
          } else {
            collectedForms.set(f.id, {
              form_file_id: f.id,
              name_ko: f.name_ko,
              department_name: f.department_name,
              university_id: f.university_id,
              university_name_ko: uniNameMap.get(f.university_id) ?? "?",
              essay_sections: (f.essay_sections ?? []) as EssaySection[],
              application_labels: [app.target_department_label ?? "(전체)"],
            });
          }
        }
      }
      forms.push(...collectedForms.values());
    }
  }

  // 기존 작문 결과 로드
  const formIds = forms.map((f) => f.form_file_id);
  const { data: drafts } =
    formIds.length > 0
      ? await supabase
          .from("study_student_essay_drafts")
          .select("*")
          .eq("student_id", id)
          .in("form_file_id", formIds)
      : { data: [] };

  return (
    <div className="space-y-4">
      <header>
        <Link
          href={`/center/students/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {student.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {tr(locale, "AI 자기소개서", "Bài luận tự động (AI)")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "학생의 상세 정보를 바탕으로 대학 지원 양식의 서술형 문항 답변을 작성합니다.",
            "Soạn câu trả lời cho các câu hỏi viết của mẫu hồ sơ trường, dựa trên thông tin chi tiết của sinh viên."
          )}
        </p>
      </header>

      {forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            {tr(
              locale,
              "이 학생에게 적용되는 서술형 문항이 없습니다.",
              "Chưa có câu hỏi viết nào áp dụng cho sinh viên này."
            )}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tr(
              locale,
              "학생에게 지원 내역이 있어야 하고, 대학 지원 양식에 서술형 문항이 정의되어 있어야 합니다.",
              "Sinh viên cần có đơn tuyển sinh, và trường cần định nghĩa câu hỏi viết trong mẫu hồ sơ."
            )}
          </p>
        </div>
      ) : (
        <EssaysClient
          locale={locale}
          studentId={id}
          forms={forms}
          drafts={(drafts ?? []).map((d) => ({
            id: d.id,
            form_file_id: d.form_file_id,
            question_index: d.question_index,
            generated_text: d.generated_text,
            edited_text: d.edited_text,
            generated_at: d.generated_at,
            edited_at: d.edited_at,
          }))}
        />
      )}
    </div>
  );
}
