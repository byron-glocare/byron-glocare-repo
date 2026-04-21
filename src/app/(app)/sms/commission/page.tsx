import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SmsCommissionView } from "@/components/sms-commission-view";
import { commissionSettlementMonth } from "@/lib/settlement";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function SmsCommissionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const now = new Date();
  const month =
    sp.month?.trim() ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mNum = parseInt(monthStr, 10);

  const supabase = await createClient();
  const [
    { data: centers },
    { data: customers },
    { data: classes },
    { data: commissionPayments },
  ] = await Promise.all([
    supabase
      .from("training_centers")
      .select("id, name, region, director_name, phone, bank_name, bank_account"),
    supabase
      .from("customers")
      .select(
        "id, code, name_kr, name_vi, training_center_id, training_class_id, class_start_date"
      )
      .not("training_center_id", "is", null),
    supabase
      .from("training_classes")
      .select("id, class_type"),
    supabase
      .from("commission_payments")
      .select("*"),
  ]);

  const classTypeMap = new Map(
    (classes ?? []).map((c) => [c.id, c.class_type])
  );

  // 이번 달 정산 대상 고객 id 집합
  const targetCustomerIds = new Set<string>();
  for (const c of customers ?? []) {
    const classType = c.training_class_id
      ? classTypeMap.get(c.training_class_id) ?? null
      : null;
    const target = commissionSettlementMonth(c.class_start_date, classType);
    if (target?.year === year && target?.month === mNum) {
      targetCustomerIds.add(c.id);
    }
  }

  // 이 고객들의 소개비 중 status != 'completed' 인 것 (미정산)
  const pendingCommissions = (commissionPayments ?? []).filter(
    (cp) =>
      targetCustomerIds.has(cp.customer_id) && cp.status !== "completed"
  );

  return (
    <>
      <PageHeader
        title="수수료 정산 알림"
        description={`${year}년 ${mNum}월 소개비 정산 대상 — 교육원별로 그룹화하여 SMS 발송`}
        breadcrumbs={[
          { href: "/sms", label: "알림발송" },
          { label: "수수료 정산" },
        ]}
      />
      <div className="p-6">
        <SmsCommissionView
          centers={centers ?? []}
          customers={customers ?? []}
          commissions={pendingCommissions}
          year={year}
          month={mNum}
          selectedMonth={month}
        />
      </div>
    </>
  );
}
