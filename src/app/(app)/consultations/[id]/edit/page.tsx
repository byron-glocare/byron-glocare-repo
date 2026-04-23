import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ConsultationForm } from "@/components/consultation-form";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditConsultationPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: consultation } = await supabase
    .from("customer_consultations")
    .select("id, customer_id, consultation_type, content_vi, content_kr")
    .eq("id", id)
    .maybeSingle();

  if (!consultation) {
    notFound();
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, code, name_vi, name_kr, phone")
    .eq("id", consultation.customer_id)
    .maybeSingle();

  if (!customer) {
    notFound();
  }

  // 수정 폼에 넣을 기본 텍스트: 베트남어 원문이 있으면 그걸, 아니면 한국어
  const initialContent =
    consultation.content_vi?.trim() || consultation.content_kr?.trim() || "";

  return (
    <>
      <PageHeader
        title="상담 일지 수정"
        breadcrumbs={[
          { href: "/customers", label: "고객관리" },
          {
            href: `/customers/${customer.id}?tab=consultations`,
            label: customer.name_vi || customer.name_kr || customer.code,
          },
          { label: "상담 일지 수정" },
        ]}
      />
      <div className="p-6">
        <ConsultationForm
          mode="edit"
          consultationId={consultation.id}
          customer={customer}
          consultationType={
            consultation.consultation_type as "training_center" | "care_home"
          }
          initialContent={initialContent}
        />
      </div>
    </>
  );
}
