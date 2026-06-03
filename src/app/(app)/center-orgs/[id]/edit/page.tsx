/**
 * /center-orgs/[id]/edit — 유학센터 회사 편집.
 */

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { OrgForm, type EditableOrg, type PlanOption } from "../../org-form";

export const dynamic = "force-dynamic";

export default async function EditCenterOrgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: org }, { data: plans }] = await Promise.all([
    supabase.from("study_center_orgs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("study_pricing_plans")
      .select("id, name, model")
      .order("created_at", { ascending: false }),
  ]);

  if (!org) notFound();

  const editable: EditableOrg = {
    id: org.id,
    name_vi: org.name_vi,
    name_ko: org.name_ko,
    country: org.country,
    tax_id: org.tax_id,
    status: org.status,
    pricing_plan_id: org.pricing_plan_id,
    settlement_currency: org.settlement_currency,
    contact_info: (org.contact_info ?? null) as EditableOrg["contact_info"],
  };

  return (
    <>
      <PageHeader
        title="유학센터 회사 편집"
        description={org.name_vi}
        breadcrumbs={[
          { label: "유학센터 회사", href: "/center-orgs" },
          { label: org.name_vi },
        ]}
      />
      <div className="p-6">
        <OrgForm org={editable} plans={(plans ?? []) as PlanOption[]} />
      </div>
    </>
  );
}
