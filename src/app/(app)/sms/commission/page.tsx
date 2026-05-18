import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  checkEligibility,
  computeCommissionAmount,
  isPendingForMonth,
  kstCurrentMonthFirstDay,
  makeCompletedMap,
  toMonthFirstDay,
} from "@/lib/commission";
import { buildCommissionNotificationMessage } from "@/lib/sms-templates";
import { SmsCommissionView } from "@/components/sms-commission-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function SmsCommissionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const month = sp.month
    ? toMonthFirstDay(sp.month + "-01")
    : kstCurrentMonthFirstDay();

  const supabase = await createClient();

  const [
    { data: customers },
    { data: centers },
    { data: classes },
    { data: reservationPayments },
    { data: welcomePackPayments },
    { data: statuses },
    { data: commissions },
    { data: settingsRows },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, code, name_kr, name_vi, product_type, training_center_id, training_class_id, class_start_date, termination_reason"
      )
      .not("training_center_id", "is", null)
      .not("training_class_id", "is", null)
      .not("class_start_date", "is", null),
    supabase
      .from("training_centers")
      .select(
        "id, name, region, business_number, director_name, email, tuition_fee_2026, deduct_reservation_by_default"
      ),
    supabase.from("training_classes").select("id, class_type, start_date"),
    supabase
      .from("reservation_payments")
      .select("customer_id, amount, payment_date"),
    supabase
      .from("welcome_pack_payments")
      .select("customer_id, reservation_date"),
    supabase
      .from("customer_statuses")
      .select(
        "customer_id, intake_abandoned, study_abroad_consultation, training_reservation_abandoned, training_dropped"
      ),
    supabase
      .from("commission_payments")
      .select(
        "id, customer_id, training_center_id, settlement_month, total_amount, deduction_amount, completed_at"
      ),
    supabase.from("system_settings").select("key, value"),
  ]);

  const settingsMap = new Map<string, unknown>();
  for (const row of settingsRows ?? []) settingsMap.set(row.key, row.value);
  const educationReservationAmount =
    typeof settingsMap.get("education_reservation_amount") === "number"
      ? (settingsMap.get("education_reservation_amount") as number)
      : typeof settingsMap.get("training_reservation_fee") === "number"
        ? (settingsMap.get("training_reservation_fee") as number)
        : 35000;

  const centerMap = new Map((centers ?? []).map((c) => [c.id, c]));
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));
  const statusMap = new Map(
    (statuses ?? []).map((s) => [s.customer_id, s])
  );
  const reservationByCustomer = new Map<
    string,
    { amount: number; payment_date: string | null }[]
  >();
  for (const rp of reservationPayments ?? []) {
    const arr = reservationByCustomer.get(rp.customer_id) ?? [];
    arr.push({ amount: rp.amount, payment_date: rp.payment_date });
    reservationByCustomer.set(rp.customer_id, arr);
  }
  const welcomePackByCustomer = new Map<
    string,
    { reservation_date: string | null }
  >();
  for (const wp of welcomePackPayments ?? []) {
    welcomePackByCustomer.set(wp.customer_id, {
      reservation_date: wp.reservation_date,
    });
  }
  const completedMap = makeCompletedMap(commissions ?? []);

  // 교육원별 그룹
  type Group = {
    centerId: string;
    centerName: string;
    region: string | null;
    rows: {
      customerId: string;
      customerName: string;
      classStartDate: string | null;
      classTypeLabel: string | null;
      tuitionBase: number;
      deduction: number;
      net: number;
      deductionReason: string;
    }[];
    totals: { total: number; deduction: number; net: number };
    message: string;
  };

  const groupsMap = new Map<string, Group>();
  for (const customer of customers ?? []) {
    if (!customer.training_center_id) continue;
    const trainingClass = customer.training_class_id
      ? classMap.get(customer.training_class_id) ?? null
      : null;
    const status = statusMap.get(customer.id) ?? null;
    const elig = checkEligibility({ customer, status, trainingClass });
    if (!elig.eligible) continue;
    if (completedMap.has(customer.id)) continue;
    if (!isPendingForMonth(elig.dueDate, month, false)) continue;
    const center = centerMap.get(customer.training_center_id);
    if (!center) continue;

    const amount = computeCommissionAmount({
      center,
      reservationPayments: reservationByCustomer.get(customer.id) ?? [],
      welcomePackPayment: welcomePackByCustomer.get(customer.id) ?? null,
      educationReservationAmount,
    });

    const row = {
      customerId: customer.id,
      customerName: customer.name_kr || customer.name_vi || "(이름 없음)",
      classStartDate: trainingClass?.start_date ?? null,
      classTypeLabel: trainingClass
        ? trainingClass.class_type === "weekday"
          ? "주간"
          : "야간"
        : null,
      tuitionBase: amount.tuitionBase,
      deduction: amount.defaultDeduction,
      net: amount.tuitionBase - amount.defaultDeduction,
      deductionReason: amount.deductionReason,
    };

    const existing = groupsMap.get(center.id);
    if (existing) {
      existing.rows.push(row);
      existing.totals.total += row.tuitionBase;
      existing.totals.deduction += row.deduction;
      existing.totals.net += row.net;
    } else {
      groupsMap.set(center.id, {
        centerId: center.id,
        centerName: center.name,
        region: center.region,
        rows: [row],
        totals: {
          total: row.tuitionBase,
          deduction: row.deduction,
          net: row.net,
        },
        message: "", // 나중에 채움
      });
    }
  }

  // 각 그룹의 SMS 본문 미리 생성
  for (const group of groupsMap.values()) {
    const center = centerMap.get(group.centerId);
    if (!center) continue;
    const deductionRow = group.rows.find((r) => r.deduction > 0);
    group.message = buildCommissionNotificationMessage({
      center,
      settlementMonth: month,
      items: group.rows.map((r) => ({
        customerName: r.customerName,
        classStartDate: r.classStartDate,
        classTypeLabel: r.classTypeLabel,
      })),
      totals: {
        tuitionSum: (center.tuition_fee_2026 ?? 0) * group.rows.length,
        totalAmount: group.totals.total,
        deductionAmount: group.totals.deduction,
        receivedAmount: group.totals.net,
      },
      deductionLabel: deductionRow?.deductionReason,
    });
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) =>
    a.centerName.localeCompare(b.centerName, "ko")
  );

  // 월 옵션 — ±6개월
  const monthOptions: string[] = [];
  const now = new Date(kstCurrentMonthFirstDay() + "T00:00:00Z");
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() + i);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthOptions.push(iso);
  }

  return (
    <>
      <PageHeader
        title="정산 내역 발송"
        description="교육원에 보낼 소개 수수료 정산 안내문 — 본문 복사 + 정산서 PDF (인쇄 → PDF 저장) 으로 직접 전송하세요."
        breadcrumbs={[
          { href: "/sms", label: "알림발송" },
          { label: "정산 내역" },
        ]}
      />
      <div className="p-6">
        <SmsCommissionView
          settlementMonth={month}
          monthOptions={monthOptions}
          groups={groups}
        />
      </div>
    </>
  );
}
