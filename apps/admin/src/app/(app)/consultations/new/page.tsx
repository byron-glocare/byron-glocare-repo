import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ConsultationForm } from "@/components/consultation-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customer_id?: string }>;

/**
 * 상담 일지 신규 작성 페이지.
 * - /consultations/new?customer_id=xxx 로 특정 고객 pre-fill
 * - 저장 시 AI 가 상담 내용 분석 → 태그 저장 + 업데이트 제안 다이얼로그
 */
export default async function NewConsultationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, code, name_vi, name_kr, phone")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="상담 일지 작성"
        breadcrumbs={[
          { href: "/customers", label: "교육생" },
          { label: "상담 일지 작성" },
        ]}
      />
      <div className="p-6">
        <ConsultationForm
          mode="create"
          customers={customers ?? []}
          prefillCustomerId={sp.customer_id}
        />
      </div>
    </>
  );
}
