/**
 * /study-invoices/new — 신규 인보이스 발행.
 */

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { InvoiceForm, type OrgOption } from "../invoice-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  const { data: orgs } = await supabase
    .from("study_center_orgs")
    .select("id, name_vi, name_ko, pricing_plan_id")
    .eq("status", "active")
    .order("name_vi", { ascending: true });

  // 가격 플랜 정보도 조회
  const planIds = Array.from(
    new Set(
      (orgs ?? [])
        .map((o) => o.pricing_plan_id)
        .filter((x): x is string => !!x)
    )
  );
  const { data: plans } =
    planIds.length > 0
      ? await supabase
          .from("study_pricing_plans")
          .select("id, name, model")
          .in("id", planIds)
      : { data: [] as Array<{ id: string; name: string; model: string }> };
  const planMap = new Map((plans ?? []).map((p) => [p.id, p]));

  const orgOptions: OrgOption[] = (orgs ?? []).map((o) => ({
    id: o.id,
    name_vi: o.name_vi,
    name_ko: o.name_ko,
    pricing_plan_id: o.pricing_plan_id,
    pricing_plan: o.pricing_plan_id ? planMap.get(o.pricing_plan_id) ?? null : null,
  }));

  return (
    <>
      <PageHeader
        title="인보이스 발행"
        description="유학센터 회사 선택 + 기간 + 항목 입력"
        breadcrumbs={[
          { label: "인보이스", href: "/study-invoices" },
          { label: "신규" },
        ]}
      />
      <div className="p-6">
        {orgOptions.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center">
            <p className="text-sm text-muted-foreground">
              활성화된 유학센터 회사가 없습니다.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              <a
                href="/center-orgs/new"
                className="text-primary hover:underline"
              >
                먼저 회사 등록
              </a>
              {" 후 인보이스를 발행할 수 있습니다."}
            </p>
          </div>
        ) : (
          <InvoiceForm orgs={orgOptions} />
        )}
      </div>
    </>
  );
}
