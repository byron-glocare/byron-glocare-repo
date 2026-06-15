/**
 * /admissions/forms/new — 작성서류(양식파일) 신규 업로드.
 *   대학·양식종류·적용범위 선택 후 파일 업로드 → AI 분석(uploadFormFileAction) → 목록으로.
 */

import { redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { NewFormDoc } from "./new-form-doc";

export const dynamic = "force-dynamic";

export default async function NewFormDocPage({
  searchParams,
}: {
  searchParams: Promise<{ university_id?: string }>;
}) {
  const sp = await searchParams;
  const preUni = sp.university_id ?? "";

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect("/login?redirect=/admissions/forms/new");

  const supabase = createAdminClient();
  const [{ data: universities }, { data: departments }] = await Promise.all([
    supabase.from("universities").select("id, name_ko").order("name_ko"),
    supabase
      .from("departments")
      .select("id, university_id, name_ko, active")
      .order("sort_order"),
  ]);

  return (
    <>
      <PageHeader
        title="작성서류 추가"
        description="양식파일 업로드 → AI가 필요 표준데이터를 정리합니다"
        breadcrumbs={[
          { href: "/admissions", label: "입학서류" },
          { label: "작성서류 추가" },
        ]}
      />
      <div className="p-6">
        <NewFormDoc
          universities={universities ?? []}
          departments={departments ?? []}
          preUniversityId={preUni}
        />
      </div>
    </>
  );
}
