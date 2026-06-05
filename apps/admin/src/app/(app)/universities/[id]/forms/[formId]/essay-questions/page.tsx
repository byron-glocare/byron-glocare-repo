/**
 * /universities/[id]/forms/[formId]/essay-questions — 양식별 서술형 질문 정의 (B4-5).
 *
 * 각 질문: { question_ko, question_vi?, max_chars?, basis_data_type_keys[] }
 */

import { notFound } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EssayQuestionsEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function FormEssayQuestionsPage({
  params,
}: {
  params: Promise<{ id: string; formId: string }>;
}) {
  const { id, formId } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  // 어드민 인증 확인 후 service role 로 조회 (RLS 우회 — 어드민 전용 페이지)
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) notFound();

  const supabase = createAdminClient();

  const [{ data: uni }, { data: form }, { data: essayBasisTypes }] =
    await Promise.all([
      supabase
        .from("universities")
        .select("id, name_ko")
        .eq("id", numericId)
        .maybeSingle(),
      supabase
        .from("study_admission_form_files")
        .select("*")
        .eq("id", formId)
        .maybeSingle(),
      supabase
        .from("study_student_data_types")
        .select("key, label_ko, label_vi, hint_ko")
        .eq("is_active", true)
        .eq("is_essay_basis", true)
        .order("sort_order"),
    ]);

  if (!uni || !form) notFound();

  return (
    <>
      <PageHeader
        title={`${form.name_ko} — 서술형 질문 정의`}
        description="이 양식이 학생에게 묻는 서술형 질문 + AI 작문 시 참조할 기초 데이터 매핑"
        breadcrumbs={[
          { label: "입학서류", href: "/admissions" },
          { label: uni.name_ko, href: `/admissions/${numericId}` },
          { label: form.name_ko },
        ]}
      />
      <div className="p-6">
        <EssayQuestionsEditor
          formFileId={formId}
          universityId={numericId}
          initialQuestions={(form.essay_questions ?? []).map((q) => ({
            question_ko: q.question_ko,
            question_vi: q.question_vi,
            max_chars: q.max_chars,
            basis_data_type_keys: q.basis_data_type_keys ?? [],
            sub_questions: q.sub_questions ?? [],
          }))}
          essayBasisTypes={(essayBasisTypes ?? []).map((t) => ({
            key: t.key,
            label_ko: t.label_ko,
            label_vi: t.label_vi,
            hint_ko: t.hint_ko,
          }))}
        />
      </div>
    </>
  );
}
