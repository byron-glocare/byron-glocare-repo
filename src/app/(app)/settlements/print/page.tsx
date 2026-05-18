import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  checkEligibility,
  computeCommissionAmount,
  isPendingForMonth,
  kstCurrentMonthFirstDay,
  makeCompletedMap,
  toMonthFirstDay,
} from "@/lib/commission";
import {
  COMPANY_INFO,
  buildCommissionNotificationMessage,
} from "@/lib/sms-templates";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  center?: string;
  month?: string; // YYYY-MM
}>;

/**
 * 정산서 인쇄용 페이지 (사용자가 Ctrl+P → PDF 저장).
 *
 * /sms/commission 에서 [정산서 페이지 열기] 로 새 탭 진입.
 * print CSS 로 페이지 헤더/사이드바 등 모두 숨김.
 */
export default async function SettlementsPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const centerId = sp.center?.trim();
  if (!centerId) notFound();
  const month = sp.month
    ? toMonthFirstDay(sp.month + "-01")
    : kstCurrentMonthFirstDay();

  const supabase = await createClient();

  const [
    { data: center },
    { data: customers },
    { data: classes },
    { data: reservationPayments },
    { data: welcomePackPayments },
    { data: statuses },
    { data: commissions },
    { data: settingsRows },
  ] = await Promise.all([
    supabase
      .from("training_centers")
      .select(
        "id, name, business_number, director_name, phone, email, tuition_fee_2026, deduct_reservation_by_default"
      )
      .eq("id", centerId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select(
        "id, code, name_kr, name_vi, product_type, training_center_id, training_class_id, class_start_date, termination_reason"
      )
      .eq("training_center_id", centerId)
      .not("training_class_id", "is", null)
      .not("class_start_date", "is", null),
    supabase
      .from("training_classes")
      .select("id, class_type, start_date")
      .eq("training_center_id", centerId),
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

  if (!center) notFound();

  const settingsMap = new Map<string, unknown>();
  for (const row of settingsRows ?? []) settingsMap.set(row.key, row.value);
  const educationReservationAmount =
    typeof settingsMap.get("education_reservation_amount") === "number"
      ? (settingsMap.get("education_reservation_amount") as number)
      : typeof settingsMap.get("training_reservation_fee") === "number"
        ? (settingsMap.get("training_reservation_fee") as number)
        : 35000;

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

  // 정산 대상 (해당 월 도래 + 미완료)
  type Row = {
    customerId: string;
    customerName: string;
    classStartDate: string | null;
    classTypeLabel: string | null;
    tuitionBase: number;
    deduction: number;
    net: number;
    deductionReason: string;
  };
  const rows: Row[] = [];
  for (const customer of customers ?? []) {
    const trainingClass = customer.training_class_id
      ? classMap.get(customer.training_class_id) ?? null
      : null;
    const status = statusMap.get(customer.id) ?? null;
    const elig = checkEligibility({ customer, status, trainingClass });
    if (!elig.eligible) continue;
    if (completedMap.has(customer.id)) continue;
    if (!isPendingForMonth(elig.dueDate, month, false)) continue;

    const amount = computeCommissionAmount({
      center,
      reservationPayments: reservationByCustomer.get(customer.id) ?? [],
      welcomePackPayment: welcomePackByCustomer.get(customer.id) ?? null,
      educationReservationAmount,
    });

    rows.push({
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
    });
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.tuition += center.tuition_fee_2026 ?? 0;
      acc.total += r.tuitionBase;
      acc.deduction += r.deduction;
      acc.net += r.net;
      return acc;
    },
    { tuition: (center.tuition_fee_2026 ?? 0) * rows.length, total: 0, deduction: 0, net: 0 }
  );

  // SMS 본문 (사용자가 복사할 텍스트와 동일 — 인쇄 페이지 하단에도 노출)
  const message = buildCommissionNotificationMessage({
    center,
    settlementMonth: month,
    items: rows.map((r) => ({
      customerName: r.customerName,
      classStartDate: r.classStartDate,
      classTypeLabel: r.classTypeLabel,
    })),
    totals: {
      tuitionSum: totals.tuition,
      totalAmount: totals.total,
      deductionAmount: totals.deduction,
      receivedAmount: totals.net,
    },
    deductionLabel:
      totals.deduction > 0
        ? rows.find((r) => r.deduction > 0)?.deductionReason ?? undefined
        : undefined,
  });

  const ym = month.slice(0, 7);
  const [year, monthNum] = ym.split("-");

  return (
    <div className="print-page bg-white text-black p-8 max-w-3xl mx-auto text-sm leading-relaxed">
      {/* print CSS — 사이드바/페이지 헤더는 별도 layout 에서 처리되므로 본 페이지는
          깔끔한 A4 컨테이너로 자체 디자인 */}
      <style>{`
        @media print {
          body { background: white !important; }
          aside, [data-slot="sidebar"], header.sticky, .no-print { display: none !important; }
          .print-page { padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      {/* 인쇄 안내 (인쇄 시 숨김) */}
      <div className="no-print mb-4 p-3 rounded-md border border-info/30 bg-info/5 text-xs">
        💡 <strong>Ctrl + P</strong> (Mac: ⌘+P) 로 인쇄 또는 PDF 저장하세요.
        브라우저의 "PDF로 저장" 옵션을 선택하면 파일이 생성됩니다.
      </div>

      <header className="mb-6 pb-4 border-b-2 border-gray-800">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-1">소개 수수료 정산서</h1>
            <p className="text-xs text-gray-600">
              {COMPANY_INFO.companyName}
            </p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <div>
              발행일: {formatDate(new Date().toISOString().slice(0, 10))}
            </div>
            <div className="font-mono mt-1">
              정산 대상: {year}년 {Number(monthNum)}월
            </div>
          </div>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-base font-semibold mb-2">1. 교육원 정보</h2>
        <table className="w-full text-xs border-collapse">
          <tbody>
            <Row label="교육원명" value={center.name} />
            <Row label="대표자" value={center.director_name ?? "—"} />
            <Row
              label="사업자등록번호"
              value={center.business_number ?? "—"}
            />
            <Row label="발행 이메일" value={center.email ?? "—"} />
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold mb-2">
          2. 대상 교육생 ({rows.length}명)
        </h2>
        <table className="w-full text-xs border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 px-2 py-1 text-left">
                이름
              </th>
              <th className="border border-gray-300 px-2 py-1 text-left">
                개강 일정
              </th>
              <th className="border border-gray-300 px-2 py-1 text-right">
                수강료 × 25%
              </th>
              <th className="border border-gray-300 px-2 py-1 text-right">
                공제
              </th>
              <th className="border border-gray-300 px-2 py-1 text-right">
                정산액
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customerId}>
                <td className="border border-gray-300 px-2 py-1">
                  {r.customerName}
                </td>
                <td className="border border-gray-300 px-2 py-1">
                  {r.classStartDate ? formatDate(r.classStartDate) : "—"}
                  {r.classTypeLabel ? ` (${r.classTypeLabel})` : ""}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">
                  {formatCurrency(r.tuitionBase)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">
                  {r.deduction > 0 ? `−${formatCurrency(r.deduction)}` : "—"}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono font-semibold">
                  {formatCurrency(r.net)}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td
                colSpan={2}
                className="border border-gray-300 px-2 py-1 text-right"
              >
                합계
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">
                {formatCurrency(totals.total)}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">
                {totals.deduction > 0
                  ? `−${formatCurrency(totals.deduction)}`
                  : "—"}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">
                {formatCurrency(totals.net)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold mb-2">3. 입금 정보</h2>
        <table className="w-full text-xs border-collapse">
          <tbody>
            <Row label="입금 계좌" value={`${COMPANY_INFO.bankName} ${COMPANY_INFO.bankAccount} (${COMPANY_INFO.companyName})`} />
            <Row label="입금액" value={formatCurrency(totals.net)} />
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="text-base font-semibold mb-2">
          4. 전자세금계산서 발행
        </h2>
        <table className="w-full text-xs border-collapse">
          <tbody>
            <Row label="발행금액" value={formatCurrency(totals.total)} />
            <Row
              label="공급가액"
              value={formatCurrency(Math.round(totals.total / 1.1))}
            />
            <Row
              label="부가세액"
              value={formatCurrency(
                totals.total - Math.round(totals.total / 1.1)
              )}
            />
            <Row label="발행일" value="입금일로부터 1주일 이내" />
          </tbody>
        </table>
      </section>

      <footer className="mt-10 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
        궁금하신 점은 글로케어로 연락주세요. 감사합니다.
      </footer>

      {/* 인쇄 시 숨김 — SMS 본문 미리보기 (다음 페이지에 같이 노출되는 게 자연스러움) */}
      <div className="no-print mt-8 p-4 rounded-md border border-gray-300 bg-gray-50">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          ↓ SMS / 카카오톡 본문 (참고용 — 별도 페이지에서 복사 가능)
        </div>
        <pre className="text-xs whitespace-pre-wrap font-sans">{message}</pre>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <tr>
      <th className="border border-gray-300 px-2 py-1 text-left bg-gray-50 w-32">
        {label}
      </th>
      <td className="border border-gray-300 px-2 py-1">{value}</td>
    </tr>
  );
}
