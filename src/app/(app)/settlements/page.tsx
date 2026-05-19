import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import {
  checkEligibility,
  computeCommissionAmount,
  isPendingForMonth,
  kstCurrentMonthFirstDay,
  makeCompletedMap,
  toMonthFirstDay,
} from "@/lib/commission";
import { computeSettlementSummary } from "@/lib/settlement";
import { computeCustomerStatus } from "@/lib/customer-status";
import { SettlementPendingCenterRow } from "@/components/settlement-pending-center-row";
import { SettlementHistoryRow } from "@/components/settlement-history-row";
import { SettlementByCustomerView } from "@/components/settlement-by-customer-view";

export const dynamic = "force-dynamic";

const VALID_TABS = ["pending", "history", "customers"] as const;
type TabKey = (typeof VALID_TABS)[number];

type SearchParams = Promise<{
  tab?: string;
  month?: string; // YYYY-MM
}>;

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tab: TabKey = VALID_TABS.includes(sp.tab as TabKey)
    ? (sp.tab as TabKey)
    : "pending";

  // 완료 내역 탭의 월 셀렉터 값 — default = 이번 달
  const currentMonth = kstCurrentMonthFirstDay();
  const historyMonth = sp.month
    ? toMonthFirstDay(sp.month + "-01")
    : currentMonth;

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
        "id, code, name_kr, name_vi, phone, product_type, training_center_id, training_class_id, class_start_date, termination_reason"
      )
      .not("training_center_id", "is", null)
      .not("training_class_id", "is", null)
      .not("class_start_date", "is", null),
    supabase
      .from("training_centers")
      .select(
        "id, name, code, region, tuition_fee_2026, deduct_reservation_by_default, business_number, director_name, email"
      ),
    supabase
      .from("training_classes")
      .select("id, class_type, start_date"),
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
        "id, customer_id, training_center_id, settlement_month, total_amount, deduction_amount, status, completed_at"
      ),
    supabase.from("system_settings").select("key, value"),
  ]);

  // 세팅에서 교육 예약금 금액
  const settingsMap = new Map<string, unknown>();
  for (const row of settingsRows ?? []) settingsMap.set(row.key, row.value);
  const educationReservationAmount =
    typeof settingsMap.get("education_reservation_amount") === "number"
      ? (settingsMap.get("education_reservation_amount") as number)
      : typeof settingsMap.get("training_reservation_fee") === "number"
        ? (settingsMap.get("training_reservation_fee") as number)
        : 35000;

  // 룩업 맵
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

  // 정산 예정 계산 — eligibility 통과 + 미완료 (도래 무관 전체).
  // isDue 플래그로 체크박스 default 결정.
  type PendingRow = {
    customerId: string;
    customerName: string;
    customerCode: string;
    classStartDate: string | null;
    classTypeLabel: string | null;
    tuitionFee: number;
    dueDate: string;
    /** 정산 예정일 도래 여부 (오늘 < dueDate <= 이번 달 말) */
    isDue: boolean;
    tuitionBase: number;
    defaultDeduction: number;
    deductionReason: string;
  };

  type PendingGroup = {
    center: NonNullable<ReturnType<typeof centerMap.get>>;
    rows: PendingRow[];
    totalBase: number;
    totalDeduction: number;
    totalNet: number;
  };

  const pendingByCenter = new Map<string, PendingGroup>();

  for (const customer of customers ?? []) {
    if (!customer.training_center_id) continue;
    const trainingClass = customer.training_class_id
      ? classMap.get(customer.training_class_id) ?? null
      : null;
    const status = statusMap.get(customer.id) ?? null;

    const elig = checkEligibility({ customer, status, trainingClass });
    if (!elig.eligible) continue;
    if (completedMap.has(customer.id)) continue;
    // 도래 무관 — 정산 안 끝난 모든 교육생 포함. 도래 여부는 isDue 로.

    const center = centerMap.get(customer.training_center_id);
    if (!center) continue;

    const amount = computeCommissionAmount({
      center,
      reservationPayments: reservationByCustomer.get(customer.id) ?? [],
      welcomePackPayment: welcomePackByCustomer.get(customer.id) ?? null,
      educationReservationAmount,
    });

    const isDue = isPendingForMonth(elig.dueDate, currentMonth, false);

    const row: PendingRow = {
      customerId: customer.id,
      customerName: customer.name_kr || customer.name_vi || "(이름 없음)",
      customerCode: customer.code,
      classStartDate: trainingClass?.start_date ?? null,
      classTypeLabel: trainingClass
        ? trainingClass.class_type === "weekday"
          ? "주간"
          : "야간"
        : null,
      tuitionFee: center.tuition_fee_2026 ?? 0,
      dueDate: elig.dueDate,
      isDue,
      tuitionBase: amount.tuitionBase,
      defaultDeduction: amount.defaultDeduction,
      deductionReason: amount.deductionReason,
    };

    // 합계는 default 체크된 (isDue) 것만 — 도래 안 한 건 default 체크 OFF.
    const addBase = row.isDue ? row.tuitionBase : 0;
    const addDed = row.isDue ? row.defaultDeduction : 0;
    const group = pendingByCenter.get(center.id);
    if (group) {
      group.rows.push(row);
      group.totalBase += addBase;
      group.totalDeduction += addDed;
      group.totalNet += addBase - addDed;
    } else {
      pendingByCenter.set(center.id, {
        center,
        rows: [row],
        totalBase: addBase,
        totalDeduction: addDed,
        totalNet: addBase - addDed,
      });
    }
  }

  const pendingGroups = Array.from(pendingByCenter.values()).sort((a, b) =>
    a.center.name.localeCompare(b.center.name, "ko")
  );

  // 완료 내역 — settlement_month 기준 그룹
  type HistoryRow = {
    customerId: string;
    customerName: string;
    customerCode: string;
    totalAmount: number;
    deductionAmount: number;
  };

  type HistoryGroup = {
    centerId: string;
    centerName: string;
    settlementMonth: string;
    /** 'completed' = 정상 수금, 'abandoned' = 수금 포기 */
    status: "completed" | "abandoned";
    rows: HistoryRow[];
    totalBase: number;
    totalDeduction: number;
    totalNet: number;
    completedAt: string;
  };

  const historyByKey = new Map<string, HistoryGroup>();
  const customerLookup = new Map(
    (customers ?? []).map((c) => [c.id, c])
  );

  for (const commission of commissions ?? []) {
    if (commission.settlement_month !== historyMonth) continue;
    // 'confirmed' (정산 확정 — 발송 대기) 는 완료 내역에서 제외.
    // /sms/commission 에서 별도 표시.
    if (commission.status === "confirmed") continue;
    const center = centerMap.get(commission.training_center_id);
    if (!center) continue;
    const customer = customerLookup.get(commission.customer_id);

    const status = (commission.status ?? "completed") as
      | "completed"
      | "abandoned";
    // 같은 month 라도 status 가 다르면 별도 group 으로 표시.
    const key = `${commission.training_center_id}::${commission.settlement_month}::${status}`;
    const row: HistoryRow = {
      customerId: commission.customer_id,
      customerName: customer
        ? customer.name_kr || customer.name_vi || "(이름 없음)"
        : "(이름 없음)",
      customerCode: customer?.code ?? "—",
      totalAmount: commission.total_amount,
      deductionAmount: commission.deduction_amount,
    };

    const existing = historyByKey.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.totalBase += row.totalAmount;
      existing.totalDeduction += row.deductionAmount;
      existing.totalNet += row.totalAmount - row.deductionAmount;
      if (commission.completed_at > existing.completedAt) {
        existing.completedAt = commission.completed_at;
      }
    } else {
      historyByKey.set(key, {
        centerId: commission.training_center_id,
        centerName: center.name,
        settlementMonth: commission.settlement_month,
        status,
        rows: [row],
        totalBase: row.totalAmount,
        totalDeduction: row.deductionAmount,
        totalNet: row.totalAmount - row.deductionAmount,
        completedAt: commission.completed_at,
      });
    }
  }

  const historyGroups = Array.from(historyByKey.values()).sort((a, b) => {
    const nameCmp = a.centerName.localeCompare(b.centerName, "ko");
    if (nameCmp !== 0) return nameCmp;
    // 완료 먼저, 포기 나중
    return a.status === b.status ? 0 : a.status === "completed" ? -1 : 1;
  });

  // 월 셀렉터 옵션 — 이번 달 기준 ±6개월
  const monthOptions: string[] = [];
  {
    const now = new Date(currentMonth + "T00:00:00Z");
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() + i);
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthOptions.push(iso);
    }
  }

  // =============================================================================
  // tab='customers' — 교육생별 정산 요약 row 계산
  // =============================================================================
  type ByCustomerRow = {
    id: string;
    code: string;
    name_vi: string | null;
    name_kr: string | null;
    stageLabel: string;
    stageKey: string;
    centerName: string | null;
    careHomeName: string | null;
    reservation: "완료" | "미완료" | "대상아님";
    commission: "완료" | "미완료" | "대상아님";
    event: "완료" | "미완료" | "대상아님";
    welcomePack: "완료" | "미완료" | "대상아님";
  };

  // Tabs 는 client-side toggle 이라 URL 의 tab 파라미터는 default 'pending' 만 옴.
  // server 가 어느 탭이든 모든 데이터를 계산해야 사용자가 [교육생별 정산] 탭 눌렀을 때
  // 즉시 표시됨. (URL 변경 없이 client 토글만으로 동작)
  let byCustomerRows: ByCustomerRow[] = [];
  {
    const [
      { data: allCustomers },
      { data: allStatuses },
      { data: allHomes },
      { data: allClasses },
      { data: allSms },
      { data: allReservations },
      { data: allWelcomePack },
      { data: allEvents },
    ] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("customer_statuses").select("*"),
      supabase.from("care_homes").select("id, name"),
      supabase.from("training_classes").select("id, class_type, start_date"),
      supabase
        .from("sms_messages")
        .select("target_customer_id, message_type"),
      supabase.from("reservation_payments").select("*"),
      supabase.from("welcome_pack_payments").select("*"),
      supabase.from("event_payments").select("*"),
    ]);

    const allCenterMap = new Map((centers ?? []).map((c) => [c.id, c]));
    const allHomeMap = new Map((allHomes ?? []).map((h) => [h.id, h]));
    const allClassMap = new Map((allClasses ?? []).map((c) => [c.id, c]));
    const allStatusMap = new Map(
      (allStatuses ?? []).map((s) => [s.customer_id, s])
    );
    const reservationsByCustomer = new Map<
      string,
      typeof allReservations
    >();
    for (const r of allReservations ?? []) {
      const arr = reservationsByCustomer.get(r.customer_id) ?? [];
      arr.push(r);
      reservationsByCustomer.set(r.customer_id, arr);
    }
    const commissionsByCustomer = new Map<
      string,
      typeof commissions
    >();
    for (const c of commissions ?? []) {
      const arr = commissionsByCustomer.get(c.customer_id) ?? [];
      arr.push(c);
      commissionsByCustomer.set(c.customer_id, arr);
    }
    const eventsByCustomer = new Map<string, typeof allEvents>();
    for (const e of allEvents ?? []) {
      const arr = eventsByCustomer.get(e.customer_id) ?? [];
      arr.push(e);
      eventsByCustomer.set(e.customer_id, arr);
    }
    const welcomePackByCustomerFull = new Map(
      (allWelcomePack ?? []).map((w) => [w.customer_id, w])
    );
    const smsByCustomer = new Map<string, typeof allSms>();
    for (const m of allSms ?? []) {
      if (!m.target_customer_id) continue;
      const arr = smsByCustomer.get(m.target_customer_id) ?? [];
      arr.push(m);
      smsByCustomer.set(m.target_customer_id, arr);
    }

    byCustomerRows = (allCustomers ?? []).map((c) => {
      const status = allStatusMap.get(c.id) ?? null;
      const trainingClass = c.training_class_id
        ? allClassMap.get(c.training_class_id) ?? null
        : null;
      const center = c.training_center_id
        ? allCenterMap.get(c.training_center_id) ?? null
        : null;
      const home = c.care_home_id
        ? allHomeMap.get(c.care_home_id) ?? null
        : null;

      const stage = computeCustomerStatus({
        customer: c,
        status: status ?? {
          customer_id: c.id,
          intake_abandoned: false,
          intake_confirmed: false,
          study_abroad_consultation: false,
          training_center_finding: false,
          class_schedule_confirmation_needed: false,
          training_reservation_abandoned: false,
          class_intake_sms_sent: false,
          certificate_acquired: false,
          training_dropped: false,
          welcome_pack_abandoned: false,
          health_check_completed: false,
          care_home_finding: false,
          resume_sent: false,
          interview_passed: false,
          updated_at: new Date().toISOString(),
        },
        reservationPayments: reservationsByCustomer.get(c.id) ?? [],
        welcomePackPayment: welcomePackByCustomerFull.get(c.id) ?? null,
        smsMessages: smsByCustomer.get(c.id) ?? [],
      });

      const summary = computeSettlementSummary({
        customer: c,
        reservationPayments: reservationsByCustomer.get(c.id) ?? [],
        commissionPayments: commissionsByCustomer.get(c.id) ?? [],
        eventPayments: eventsByCustomer.get(c.id) ?? [],
        welcomePackPayment: welcomePackByCustomerFull.get(c.id) ?? null,
      });

      return {
        id: c.id,
        code: c.code,
        name_vi: c.name_vi,
        name_kr: c.name_kr,
        stageLabel: stage.label,
        stageKey: stage.currentStage,
        centerName: center?.name ?? null,
        careHomeName: home?.name ?? null,
        reservation: summary.reservation,
        commission: summary.commission,
        event: summary.event,
        welcomePack: summary.welcomePack,
        // trainingClass is referenced for fetch consistency
        _classType: trainingClass?.class_type ?? null,
      } as ByCustomerRow;
    });

    // 정렬: 단계 우선 → 이름
    byCustomerRows.sort((a, b) =>
      (a.name_vi ?? a.name_kr ?? "").localeCompare(
        b.name_vi ?? b.name_kr ?? "",
        "ko"
      )
    );
  }

  return (
    <>
      <PageHeader
        title="정산"
        description="교육원별 소개비 정산 — 수강료 × 25% − 교육 예약금 공제"
        breadcrumbs={[{ label: "정산" }]}
      />
      <div className="p-6">
        <Tabs defaultValue={tab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full h-10">
            <TabsTrigger
              value="pending"
              className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
            >
              정산 예정{" "}
              <Badge variant="secondary" className="ml-1.5">
                {pendingGroups.reduce((s, g) => s + g.rows.length, 0)}명
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
            >
              완료 내역
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="text-sm data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold"
            >
              교육생별 정산
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6 space-y-4">
            {pendingGroups.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                현재 정산 예정인 교육생이 없습니다.
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <div className="text-xs text-muted-foreground">
                    기준{" "}
                    <span className="font-mono">
                      {currentMonth.slice(0, 7)}
                    </span>{" "}
                    말까지 정산 예정일 도래 · 과거 누적 미정산 포함
                  </div>
                  <div className="text-sm">
                    전체{" "}
                    <span className="font-semibold">
                      {formatCurrency(
                        pendingGroups.reduce((s, g) => s + g.totalNet, 0)
                      )}
                    </span>
                  </div>
                </div>
                {pendingGroups.map((group) => (
                  <SettlementPendingCenterRow
                    key={group.center.id}
                    center={group.center}
                    rows={group.rows}
                    totalBase={group.totalBase}
                    totalDefaultDeduction={group.totalDeduction}
                    totalNet={group.totalNet}
                    settlementMonth={currentMonth}
                  />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-4">
            <form method="get" className="flex flex-wrap gap-2 items-end">
              <input type="hidden" name="tab" value="history" />
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  정산 월
                </label>
                <select
                  name="month"
                  defaultValue={historyMonth.slice(0, 7)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-28"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className={buttonVariants()}>
                조회
              </button>
              <Link
                href="/settlements?tab=history"
                className={buttonVariants({ variant: "ghost" })}
              >
                이번 달
              </Link>
            </form>

            {historyGroups.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                {historyMonth.slice(0, 7)} 에 완료된 정산이 없습니다.
              </Card>
            ) : (
              historyGroups.map((group) => (
                <SettlementHistoryRow
                  key={`${group.centerId}-${group.settlementMonth}-${group.status}`}
                  centerId={group.centerId}
                  centerName={group.centerName}
                  settlementMonth={group.settlementMonth}
                  status={group.status}
                  rows={group.rows}
                  totalBase={group.totalBase}
                  totalDeduction={group.totalDeduction}
                  totalNet={group.totalNet}
                  completedAt={group.completedAt}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="customers" className="mt-6 space-y-4">
            <SettlementByCustomerView rows={byCustomerRows} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
