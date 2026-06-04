/**
 * /pricing-plans/[id]/edit — 가격 플랜 편집.
 */

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PlanForm, type EditablePlan } from "../../plan-form";

export const dynamic = "force-dynamic";

export default async function EditPricingPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("study_pricing_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!plan) notFound();

  const editable: EditablePlan = {
    id: plan.id,
    name: plan.name,
    model: plan.model,
    currency: plan.currency,
    per_student_fee: plan.per_student_fee != null ? Number(plan.per_student_fee) : null,
    monthly_fee: plan.monthly_fee != null ? Number(plan.monthly_fee) : null,
    percentage_rate: plan.percentage_rate != null ? Number(plan.percentage_rate) : null,
    percentage_basis: plan.percentage_basis,
    hybrid_params: plan.hybrid_params,
    notes: plan.notes,
    is_active: plan.is_active,
    effective_from: plan.effective_from,
    effective_to: plan.effective_to,
  };

  return (
    <>
      <PageHeader
        title="가격 플랜 편집"
        description={plan.name}
        breadcrumbs={[
          { label: "가격 플랜", href: "/pricing-plans" },
          { label: plan.name },
        ]}
      />
      <div className="p-6">
        <PlanForm plan={editable} />
      </div>
    </>
  );
}
