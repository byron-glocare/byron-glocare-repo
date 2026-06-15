/**
 * /admissions/submissions/new — 발급서류 신규.
 *   공용(전체 공통) 또는 대학별. 대학별은 공용 마스터를 기반으로 이름 자동완성 + base 연결.
 *   생성 후 상세에서 샘플 이미지·발급요건을 마저 편집.
 */

import { redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { NewSubmissionDoc } from "./new-submission-doc";

export const dynamic = "force-dynamic";

export default async function NewSubmissionDocPage() {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect("/login?redirect=/admissions/submissions/new");

  const supabase = createAdminClient();
  const [{ data: universities }, { data: masters }] = await Promise.all([
    supabase.from("universities").select("id, name_ko").order("name_ko"),
    supabase
      .from("study_required_submissions")
      .select("id, name_ko")
      .is("university_id", null)
      .is("base_submission_id", null)
      .order("sort_order"),
  ]);

  return (
    <>
      <PageHeader
        title="발급서류 추가"
        description="공용 또는 대학별 발급서류를 만듭니다"
        breadcrumbs={[
          { href: "/admissions", label: "입학서류" },
          { label: "발급서류 추가" },
        ]}
      />
      <div className="p-6">
        <NewSubmissionDoc
          universities={universities ?? []}
          masters={masters ?? []}
        />
      </div>
    </>
  );
}
