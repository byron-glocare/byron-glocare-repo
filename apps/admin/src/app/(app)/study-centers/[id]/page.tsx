import { notFound } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StudyCenterForm } from "@/components/study-center-form";
import { StudyCenterSettlement } from "@/components/study-center-settlement";
import type { StudyCenterInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function StudyCenterEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("study_centers")
    .select("*")
    .eq("id", numericId)
    .single();

  if (error || !row) notFound();

  // 정산(1:1 org) + 가격 플랜 + 이 센터의 로그인 계정 로드 (service role)
  const admin = createAdminClient();
  const [{ data: org }, { data: plans }] = await Promise.all([
    admin
      .from("study_center_orgs")
      .select("id, pricing_plan_id, settlement_currency, status")
      .eq("study_center_id", numericId)
      .limit(1)
      .maybeSingle(),
    admin.from("study_pricing_plans").select("id, name, model").order("name"),
  ]);

  const { data: centerUsers } = org?.id
    ? await admin
        .from("study_center_users")
        .select("email, role, status")
        .eq("org_id", org.id)
        .order("created_at")
    : { data: [] };

  const defaultValues: Partial<StudyCenterInput> = {
    active: row.active,
    flag: row.flag,
    name_ko: row.name_ko,
    name_vi: row.name_vi,
    city_ko: row.city_ko,
    city_vi: row.city_vi,
    address: row.address,
    phone: row.phone,
    email: row.email,
    desc_ko: row.desc_ko,
    desc_vi: row.desc_vi,
    students_ko: row.students_ko,
    students_vi: row.students_vi,
    years_ko: row.years_ko,
    years_vi: row.years_vi,
  };

  return (
    <>
      <PageHeader
        title={`${row.flag ?? "🇻🇳"} ${row.name_vi}`}
        description={`센터 #${numericId}`}
        breadcrumbs={[
          { href: "/study-centers", label: "유학센터" },
          { label: row.name_vi },
        ]}
      />
      <div className="space-y-6 p-6">
        <StudyCenterForm
          mode="edit"
          centerId={numericId}
          defaultValues={defaultValues}
        />
        <StudyCenterSettlement
          studyCenterId={numericId}
          plans={plans ?? []}
          current={
            org
              ? {
                  pricingPlanId: org.pricing_plan_id,
                  currency: org.settlement_currency,
                  status: org.status,
                }
              : null
          }
          accounts={centerUsers ?? []}
        />
      </div>
    </>
  );
}
