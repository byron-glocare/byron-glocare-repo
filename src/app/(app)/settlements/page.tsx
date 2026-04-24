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
import { SettlementPendingCenterRow } from "@/components/settlement-pending-center-row";
import { SettlementHistoryRow } from "@/components/settlement-history-row";

export const dynamic = "force-dynamic";

const VALID_TABS = ["pending", "history"] as const;
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
        "id, name, code, region, tuition_fee_2026, deduct_reservation_by_default"
      ),
    supabase.from("training_classes").select("id, class_type"),
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

  // 정산 예정 계산 (전체 미완료 + due <= 이번 달 말)
  type PendingRow = {
    customerId: string;
    customerName: string;
    customerCode: string;
    dueDate: string;
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
    if (!isPendingForMonth(elig.dueDate, currentMonth, false)) continue;

    const center = centerMap.get(customer.training_center_id);
    if (!center) continue;

    const amount = computeCommissionAmount({
      center,
      reservationPayments: reservationByCustomer.get(customer.id) ?? [],
      welcomePackPayment: welcomePackByCustomer.get(customer.id) ?? null,
      educationReservationAmount,
    });

    const row: PendingRow = {
      customerId: customer.id,
      customerName: customer.name_kr || customer.name_vi || "(이름 없음)",
      customerCode: customer.code,
      dueDate: elig.dueDate,
      tuitionBase: amount.tuitionBase,
      defaultDeduction: amount.defaultDeduction,
      deductionReason: amount.deductionReason,
    };

    const group = pendingByCenter.get(center.id);
    if (group) {
      group.rows.push(row);
      group.totalBase += row.tuitionBase;
      group.totalDeduction += row.defaultDeduction;
      group.totalNet += row.tuitionBase - row.defaultDeduction;
    } else {
      pendingByCenter.set(center.id, {
        center,
        rows: [row],
        totalBase: row.tuitionBase,
        totalDeduction: row.defaultDeduction,
        totalNet: row.tuitionBase - row.defaultDeduction,
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
    const center = centerMap.get(commission.training_center_id);
    if (!center) continue;
    const customer = customerLookup.get(commission.customer_id);

    const key = `${commission.training_center_id}::${commission.settlement_month}`;
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
        rows: [row],
        totalBase: row.totalAmount,
        totalDeduction: row.deductionAmount,
        totalNet: row.totalAmount - row.deductionAmount,
        completedAt: commission.completed_at,
      });
    }
  }

  const historyGroups = Array.from(historyByKey.values()).sort((a, b) =>
    a.centerName.localeCompare(b.centerName, "ko")
  );

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

  return (
    <>
      <PageHeader
        title="정산"
        description="교육원별 소개비 정산 — 수강료 × 25% − 교육 예약금 공제"
        breadcrumbs={[{ label: "정산" }]}
      />
      <div className="p-6">
        <Tabs defaultValue={tab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full h-10">
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
                  key={`${group.centerId}-${group.settlementMonth}`}
                  centerId={group.centerId}
                  centerName={group.centerName}
                  settlementMonth={group.settlementMonth}
                  rows={group.rows}
                  totalBase={group.totalBase}
                  totalDeduction={group.totalDeduction}
                  totalNet={group.totalNet}
                  completedAt={group.completedAt}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
