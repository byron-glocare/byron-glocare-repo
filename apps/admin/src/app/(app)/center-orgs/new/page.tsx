/**
 * /center-orgs/new — 유학센터 회사 신규 등록.
 */

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { OrgForm, type PlanOption } from "../org-form";

export const dynamic = "force-dynamic";

export default async function NewCenterOrgPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("study_pricing_plans")
    .select("id, name, model")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="유학센터 회사 등록"
        description="B2B 청구 단위 신규 등록"
        breadcrumbs={[
          { label: "유학센터 회사", href: "/center-orgs" },
          { label: "신규" },
        ]}
      />
      <div className="p-6">
        <OrgForm plans={(plans ?? []) as PlanOption[]} />
      </div>
    </>
  );
}
