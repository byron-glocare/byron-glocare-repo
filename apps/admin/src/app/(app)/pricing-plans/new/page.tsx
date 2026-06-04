/**
 * /pricing-plans/new — 가격 플랜 신규 등록.
 */

import { PageHeader } from "@/components/page-header";
import { PlanForm } from "../plan-form";

export default function NewPricingPlanPage() {
  return (
    <>
      <PageHeader
        title="가격 플랜 등록"
        description="유학센터에 부과할 청구 모델"
        breadcrumbs={[
          { label: "가격 플랜", href: "/pricing-plans" },
          { label: "신규" },
        ]}
      />
      <div className="p-6">
        <PlanForm />
      </div>
    </>
  );
}
