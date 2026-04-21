import Link from "next/link";
import { ArrowRight, Calendar, GraduationCap, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  computeSettlementSummary,
  commissionSettlementMonth,
  type SettlementFlag,
} from "@/lib/settlement";
import { dash, formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  view?: string;
  q?: string;
  center?: string;
  month?: string; // YYYY-MM
}>;

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const view = sp.view === "center" ? "center" : "customer";
  const q = sp.q?.trim() ?? "";
  const selectedCenter = sp.center?.trim() ?? "";

  // YYYY-MM 파싱
  const now = new Date();
  const month =
    sp.month?.trim() ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mNum = parseInt(monthStr, 10);

  const supabase = await createClient();

  // 모든 고객 + 결제 로드
  const [
    { data: customers },
    { data: centers },
    { data: reservationPayments },
    { data: commissionPayments },
    { data: eventPayments },
    { data: welcomePackPayments },
    { data: trainingClasses },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, code, name_kr, name_vi, phone, product_type, training_center_id, training_class_id, class_start_date"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("training_centers")
      .select("id, code, name, region")
      .order("name"),
    supabase
      .from("reservation_payments")
      .select("customer_id, payment_date, amount, refund_reason"),
    supabase
      .from("commission_payments")
      .select(
        "customer_id, training_center_id, status, total_amount, deduction_amount, received_amount, received_date, tax_invoice_issued, tax_invoice_date"
      ),
    supabase.from("event_payments").select("customer_id, gift_given"),
    supabase
      .from("welcome_pack_payments")
      .select("customer_id, sales_reported"),
    supabase
      .from("training_classes")
      .select("id, class_type"),
  ]);

  const centerMap = new Map((centers ?? []).map((c) => [c.id, c]));
  const classTypeMap = new Map(
    (trainingClasses ?? []).map((tc) => [tc.id, tc.class_type])
  );

  // customer_id 별로 그룹핑
  const reservationsByCustomer = groupBy(
    reservationPayments ?? [],
    (r) => r.customer_id
  );
  const commissionsByCustomer = groupBy(
    commissionPayments ?? [],
    (c) => c.customer_id
  );
  const eventsByCustomer = groupBy(
    eventPayments ?? [],
    (e) => e.customer_id
  );
  const welcomeMap = new Map(
    (welcomePackPayments ?? []).map((w) => [w.customer_id, w])
  );

  // 각 고객의 settlement summary 계산
  const rows = (customers ?? []).map((c) => {
    const summary = computeSettlementSummary({
      customer: { product_type: c.product_type },
      reservationPayments: reservationsByCustomer.get(c.id) ?? [],
      commissionPayments: commissionsByCustomer.get(c.id) ?? [],
      eventPayments: eventsByCustomer.get(c.id) ?? [],
      welcomePackPayment: welcomeMap.get(c.id) ?? null,
    });

    // 소개비 정산 대상 월 계산
    const classType = c.training_class_id
      ? classTypeMap.get(c.training_class_id) ?? null
      : null;
    const targetMonth = commissionSettlementMonth(
      c.class_start_date,
      classType ?? null
    );

    return {
      customer: c,
      summary,
      targetMonth,
      classType,
      commission: (commissionsByCustomer.get(c.id) ?? [])[0] ?? null,
    };
  });

  // 뷰별 필터링
  const filteredRows = rows.filter((r) => {
    if (q) {
      const text = `${r.customer.code} ${r.customer.name_kr ?? ""} ${r.customer.name_vi ?? ""} ${r.customer.phone ?? ""}`.toLowerCase();
      if (!text.includes(q.toLowerCase())) return false;
    }
    if (view === "center" && selectedCenter) {
      if (r.customer.training_center_id !== selectedCenter) return false;
    }
    return true;
  });

  // §5.3 정산 대상 월 매칭
  const commissionTargetsThisMonth = rows.filter(
    (r) => r.targetMonth?.year === year && r.targetMonth?.month === mNum
  );

  return (
    <>
      <PageHeader
        title="정산"
        description="교육생별 / 교육원별 정산 현황 + 소개비 정산 대상 자동 선정"
        breadcrumbs={[{ label: "정산" }]}
      />
      <div className="p-6 space-y-6">
        {/* 이번 달 소개비 정산 대상 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="size-4" />
              {year}년 {mNum}월 소개비 정산 대상 ({commissionTargetsThisMonth.length}명)
            </CardTitle>
            <CardDescription>
              주간반: 강의시작 + 45일 / 야간반: 강의시작 + 75일 기준 (§5.3)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" className="flex gap-2 items-end mb-4">
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="center" value={selectedCenter} />
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  월 선택
                </label>
                <Input
                  type="month"
                  name="month"
                  defaultValue={month}
                  className="w-44"
                />
              </div>
              <button
                type="submit"
                className={buttonVariants({ variant: "outline" })}
              >
                적용
              </button>
            </form>

            {commissionTargetsThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
                이번 달 정산 대상 교육생이 없습니다.
              </p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>고객</TableHead>
                      <TableHead>교육원</TableHead>
                      <TableHead>구분</TableHead>
                      <TableHead>개강일</TableHead>
                      <TableHead>소개비 상태</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionTargetsThisMonth.map((r) => (
                      <TableRow key={r.customer.id}>
                        <TableCell>
                          <Link
                            href={`/customers/${r.customer.id}?tab=settlement`}
                            className="hover:text-primary"
                          >
                            <div className="text-sm font-medium">
                              {r.customer.name_kr ||
                                r.customer.name_vi ||
                                "(이름 없음)"}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {r.customer.code}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.customer.training_center_id
                            ? centerMap.get(r.customer.training_center_id)?.name ?? "—"
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {r.classType && (
                            <Badge
                              variant="outline"
                              className={
                                r.classType === "weekday"
                                  ? "bg-info/10 text-info border-info/20"
                                  : "bg-warning/10 text-warning border-warning/20"
                              }
                            >
                              {r.classType === "weekday" ? "주간" : "야간"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(r.customer.class_start_date)}
                        </TableCell>
                        <TableCell>
                          <SettlementBadge flag={r.summary.commission} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/customers/${r.customer.id}?tab=settlement`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            정산 <ArrowRight className="size-3" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 뷰 전환 */}
        <div className="flex gap-1 border-b border-border">
          <Link
            href="/settlements?view=customer"
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
              view === "customer"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-4" />
            교육생별
          </Link>
          <Link
            href="/settlements?view=center"
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
              view === "center"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <GraduationCap className="size-4" />
            교육원별
          </Link>
        </div>

        {view === "customer" && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">교육생별 정산 현황</CardTitle>
                <CardDescription>
                  검색해서 선택 → 해당 고객 정산 탭으로 이동
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form method="get" className="flex gap-2 items-end">
                  <input type="hidden" name="view" value="customer" />
                  <input type="hidden" name="month" value={month} />
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground block mb-1">
                      검색
                    </label>
                    <Input
                      name="q"
                      defaultValue={q}
                      placeholder="코드 · 이름 · 전화"
                    />
                  </div>
                  <button
                    type="submit"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    검색
                  </button>
                  {q && (
                    <Link
                      href="/settlements?view=customer"
                      className={buttonVariants({ variant: "ghost" })}
                    >
                      초기화
                    </Link>
                  )}
                </form>

                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>고객</TableHead>
                        <TableHead>상품</TableHead>
                        <TableHead>예약금</TableHead>
                        <TableHead>소개비</TableHead>
                        <TableHead>이벤트</TableHead>
                        <TableHead>웰컴팩</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.slice(0, 100).map((r) => (
                        <TableRow key={r.customer.id}>
                          <TableCell>
                            <Link
                              href={`/customers/${r.customer.id}?tab=settlement`}
                              className="hover:text-primary"
                            >
                              <div className="text-sm font-medium">
                                {r.customer.name_kr ||
                                  r.customer.name_vi ||
                                  "(이름 없음)"}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {r.customer.code}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {dash(r.customer.product_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <SettlementBadge flag={r.summary.reservation} />
                          </TableCell>
                          <TableCell>
                            <SettlementBadge flag={r.summary.commission} />
                          </TableCell>
                          <TableCell>
                            <SettlementBadge flag={r.summary.event} />
                          </TableCell>
                          <TableCell>
                            <SettlementBadge flag={r.summary.welcomePack} />
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/customers/${r.customer.id}?tab=settlement`}
                              className={buttonVariants({
                                variant: "outline",
                                size: "sm",
                              })}
                            >
                              <ArrowRight className="size-3" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredRows.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center">
                    전체 {filteredRows.length}명 중 100명 표시. 검색으로 좁혀주세요.
                  </p>
                )}
                {filteredRows.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    조건에 맞는 고객이 없습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {view === "center" && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">교육원별 정산 현황</CardTitle>
                <CardDescription>
                  교육원을 선택해서 소속 교육생의 정산 상태를 한눈에
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form method="get" className="flex gap-2 items-end">
                  <input type="hidden" name="view" value="center" />
                  <input type="hidden" name="month" value={month} />
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      교육원
                    </label>
                    <select
                      name="center"
                      defaultValue={selectedCenter}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-60"
                    >
                      <option value="">전체</option>
                      {(centers ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    적용
                  </button>
                </form>

                {selectedCenter ? (
                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>고객</TableHead>
                          <TableHead>구분</TableHead>
                          <TableHead>개강일</TableHead>
                          <TableHead>정산 대상월</TableHead>
                          <TableHead>소개비 총액</TableHead>
                          <TableHead>수령액</TableHead>
                          <TableHead>상태</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center text-sm text-muted-foreground py-6"
                            >
                              해당 교육원 소속 교육생이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRows.map((r) => (
                            <TableRow key={r.customer.id}>
                              <TableCell>
                                <Link
                                  href={`/customers/${r.customer.id}?tab=settlement`}
                                  className="hover:text-primary"
                                >
                                  <div className="text-sm font-medium">
                                    {r.customer.name_kr ||
                                      r.customer.name_vi ||
                                      "(이름 없음)"}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {r.customer.code}
                                  </div>
                                </Link>
                              </TableCell>
                              <TableCell>
                                {r.classType && (
                                  <Badge variant="outline">
                                    {r.classType === "weekday"
                                      ? "주간"
                                      : "야간"}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {formatDate(r.customer.class_start_date)}
                              </TableCell>
                              <TableCell>
                                {r.targetMonth
                                  ? `${r.targetMonth.year}/${r.targetMonth.month}`
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {r.commission
                                  ? formatCurrency(r.commission.total_amount)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {r.commission
                                  ? formatCurrency(
                                      r.commission.received_amount ?? 0
                                    )
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <SettlementBadge flag={r.summary.commission} />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    교육원을 선택하세요.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

// =============================================================================
// 유틸
// =============================================================================

function SettlementBadge({ flag }: { flag: SettlementFlag }) {
  const cls =
    flag === "완료"
      ? "bg-success/10 text-success border-success/20"
      : flag === "미완료"
        ? "bg-warning/10 text-warning border-warning/20"
        : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cls}>
      {flag}
    </Badge>
  );
}

function groupBy<T, K>(arr: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = keyFn(item);
    const existing = m.get(k);
    if (existing) existing.push(item);
    else m.set(k, [item]);
  }
  return m;
}
