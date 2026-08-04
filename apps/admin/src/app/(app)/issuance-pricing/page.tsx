import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";

import { PricingManager, type PricingRow } from "./pricing-manager";

export const dynamic = "force-dynamic";

export default async function IssuancePricingPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("study_issuance_pricing")
    .select(
      "id, std_key, label_ko, notarization, unit_price, proxy_unavailable_surcharge, sort_order, is_active"
    )
    .order("sort_order");

  const rows = (data ?? []) as PricingRow[];

  return (
    <>
      <PageHeader
        title="발급 단가표 (개발중)"
        description="발급 대행 서류 × 인증조건별 단가. B2C 발급 신청 화면에 노출됩니다."
        breadcrumbs={[{ label: "발급 단가표" }]}
      />
      <div className="p-6">
        <PricingManager rows={rows} />
      </div>
    </>
  );
}
