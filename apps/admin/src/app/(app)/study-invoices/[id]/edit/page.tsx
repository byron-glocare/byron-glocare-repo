/**
 * /study-invoices/[id]/edit — 인보이스 편집.
 */

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  InvoiceForm,
  type EditableInvoice,
  type LineItem,
  type OrgOption,
} from "../../invoice-form";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("study_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!inv) notFound();

  const { data: org } = await supabase
    .from("study_center_orgs")
    .select("id, name_vi, name_ko, pricing_plan_id")
    .eq("id", inv.org_id)
    .maybeSingle();

  // 편집 화면에서는 현재 회사만 dropdown에 보여줌 (변경 불가)
  const orgs: OrgOption[] = org
    ? [
        {
          id: org.id,
          name_vi: org.name_vi,
          name_ko: org.name_ko,
          pricing_plan_id: org.pricing_plan_id,
          pricing_plan: null,
        },
      ]
    : [];

  const editable: EditableInvoice = {
    id: inv.id,
    org_id: inv.org_id,
    period_start: inv.period_start,
    period_end: inv.period_end,
    line_items: (Array.isArray(inv.line_items) ? inv.line_items : []) as LineItem[],
    total_amount: Number(inv.total_amount),
    currency: inv.currency,
    status: inv.status,
    tax_invoice_url: inv.tax_invoice_url,
  };

  return (
    <>
      <PageHeader
        title="인보이스 편집"
        description={`${org?.name_vi ?? "?"} — ${inv.period_start} ~ ${inv.period_end}`}
        breadcrumbs={[
          { label: "인보이스", href: "/study-invoices" },
          {
            label: org?.name_vi ?? "상세",
            href: `/study-invoices/${id}`,
          },
          { label: "편집" },
        ]}
      />
      <div className="p-6">
        <InvoiceForm invoice={editable} orgs={orgs} />
      </div>
    </>
  );
}
