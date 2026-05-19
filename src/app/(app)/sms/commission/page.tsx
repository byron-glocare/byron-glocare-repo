import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buildCommissionNotificationMessage } from "@/lib/sms-templates";
import { SmsCommissionView } from "@/components/sms-commission-view";

export const dynamic = "force-dynamic";

export default async function SmsCommissionPage() {
  const supabase = await createClient();

  // 정산 확정된 row (status='confirmed') 만 — 0019.
  // 확정 후 발송 대기 상태.
  const [
    { data: confirmedRows },
    { data: centers },
    { data: customers },
    { data: classes },
  ] = await Promise.all([
    supabase
      .from("commission_payments")
      .select(
        "id, customer_id, training_center_id, settlement_month, total_amount, deduction_amount, status"
      )
      .eq("status", "confirmed")
      .order("settlement_month", { ascending: false }),
    supabase
      .from("training_centers")
      .select(
        "id, name, region, business_number, director_name, director_phone, phone, email, tuition_fee_2026"
      ),
    supabase
      .from("customers")
      .select(
        "id, name_kr, name_vi, training_class_id, class_start_date"
      ),
    supabase
      .from("training_classes")
      .select("id, class_type, start_date"),
  ]);

  const centerMap = new Map((centers ?? []).map((c) => [c.id, c]));
  const customerMap = new Map((customers ?? []).map((c) => [c.id, c]));
  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));

  // 교육원 + 월 단위로 그룹화
  type Row = {
    commissionId: string;
    customerId: string;
    customerName: string;
    classStartDate: string | null;
    classTypeLabel: string | null;
    tuitionBase: number;
    deduction: number;
    net: number;
  };

  type Group = {
    centerId: string;
    centerName: string;
    region: string | null;
    /** 수신자 default — 대표자 연락처. 없으면 빈 문자열. */
    directorPhone: string;
    /** 대표자 이름 — 표시용 */
    directorName: string;
    /** 발행 이메일 — 표시용 */
    email: string;
    settlementMonth: string;
    rows: Row[];
    totals: { total: number; deduction: number; net: number };
    message: string;
  };

  const groupsMap = new Map<string, Group>();
  for (const cp of confirmedRows ?? []) {
    const center = centerMap.get(cp.training_center_id);
    if (!center) continue;
    const customer = customerMap.get(cp.customer_id);
    const trainingClass = customer?.training_class_id
      ? classMap.get(customer.training_class_id) ?? null
      : null;

    const row: Row = {
      commissionId: cp.id,
      customerId: cp.customer_id,
      customerName: customer
        ? customer.name_kr || customer.name_vi || "(이름 없음)"
        : "(이름 없음)",
      classStartDate:
        trainingClass?.start_date ?? customer?.class_start_date ?? null,
      classTypeLabel: trainingClass
        ? trainingClass.class_type === "weekday"
          ? "주간"
          : "야간"
        : null,
      tuitionBase: cp.total_amount,
      deduction: cp.deduction_amount,
      net: Math.max(0, cp.total_amount - cp.deduction_amount),
    };

    // group key: center × settlement_month
    const key = `${cp.training_center_id}::${cp.settlement_month}`;
    const existing = groupsMap.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.totals.total += row.tuitionBase;
      existing.totals.deduction += row.deduction;
      existing.totals.net += row.net;
    } else {
      groupsMap.set(key, {
        centerId: center.id,
        centerName: center.name,
        region: center.region,
        directorPhone: center.director_phone ?? "",
        directorName: center.director_name ?? "",
        email: center.email ?? "",
        settlementMonth: cp.settlement_month,
        rows: [row],
        totals: {
          total: row.tuitionBase,
          deduction: row.deduction,
          net: row.net,
        },
        message: "",
      });
    }
  }

  // 각 그룹의 SMS 본문 미리 생성
  for (const group of groupsMap.values()) {
    const center = centerMap.get(group.centerId);
    if (!center) continue;
    group.message = buildCommissionNotificationMessage({
      center,
      settlementMonth: group.settlementMonth,
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
      deductionLabel:
        group.totals.deduction > 0 ? "교육 예약금" : undefined,
    });
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    // 월 desc 후 교육원 이름
    const m = b.settlementMonth.localeCompare(a.settlementMonth);
    if (m !== 0) return m;
    return a.centerName.localeCompare(b.centerName, "ko");
  });

  return (
    <>
      <PageHeader
        title="정산 내역 발송"
        description="확정된 정산 내역 — 본문 복사 + 정산서 PDF 로 직접 전송하세요. 입금 받은 후 [완료 처리] 로 마무리."
        breadcrumbs={[
          { href: "/sms", label: "알림발송" },
          { label: "정산 내역" },
        ]}
      />
      <div className="p-6">
        <SmsCommissionView groups={groups} />
      </div>
    </>
  );
}
