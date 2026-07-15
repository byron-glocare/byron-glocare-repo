import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SmsNewStudentView } from "@/components/sms-new-student-view";
import { computeCustomerStatus } from "@/lib/customer-status";

export const dynamic = "force-dynamic";

export default async function SmsNewStudentPage() {
  const supabase = await createClient();

  const [
    { data: centers },
    { data: customers },
    { data: classes },
    { data: sentMessages },
    { data: statuses },
    { data: reservationPayments },
    { data: welcomePackPayments },
    { data: allSms },
  ] = await Promise.all([
    supabase
      .from("training_centers")
      .select("id, name, region, director_name, phone"),
    supabase
      .from("customers")
      .select("*")
      .not("training_center_id", "is", null),
    supabase
      .from("training_classes")
      .select("id, training_center_id, year, month, class_type, start_date"),
    supabase
      .from("sms_messages")
      .select("target_customer_id, target_center_id")
      .eq("message_type", "new_student")
      .not("target_customer_id", "is", null),
    supabase.from("customer_statuses").select("*"),
    supabase
      .from("reservation_payments")
      .select("customer_id, payment_date, amount"),
    supabase
      .from("welcome_pack_payments")
      .select("customer_id, reservation_date"),
    supabase
      .from("sms_messages")
      .select("target_customer_id, message_type"),
  ]);

  // "이미 보냄" 판정 — (학생 × 교육원) 조합.
  // 학생이 다른 교육원으로 옮기면, 이전 교육원에서 보낸 기록은 새 교육원에서
  // "이미 보냄"으로 잡히면 안 됨 → 복합키 `${centerId}:${customerId}`.
  const sentPairs = new Set(
    (sentMessages ?? [])
      .filter((m) => m.target_customer_id && m.target_center_id)
      .map((m) => `${m.target_center_id}:${m.target_customer_id}`)
  );

  // 0022: stage 계산 — '강의 접수 메시지 발송 대기' 인 학생만 default 체크
  const statusMap = new Map(
    (statuses ?? []).map((s) => [s.customer_id, s])
  );
  const reservationsByCustomer = new Map<
    string,
    { payment_date: string | null; amount: number }[]
  >();
  for (const r of reservationPayments ?? []) {
    const arr = reservationsByCustomer.get(r.customer_id) ?? [];
    arr.push({ payment_date: r.payment_date, amount: r.amount });
    reservationsByCustomer.set(r.customer_id, arr);
  }
  // 학생별 예약금 합계 (메시지 본문 "예약금(시험비)" 항목용)
  const reservationAmountByCustomer = new Map<string, number>();
  for (const [cid, rows] of reservationsByCustomer) {
    const sum = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    reservationAmountByCustomer.set(cid, sum);
  }
  const welcomeByCustomer = new Map(
    (welcomePackPayments ?? []).map((w) => [
      w.customer_id,
      { reservation_date: w.reservation_date },
    ])
  );
  const smsByCustomer = new Map<string, { message_type: string }[]>();
  for (const m of allSms ?? []) {
    if (!m.target_customer_id || !m.message_type) continue;
    const arr = smsByCustomer.get(m.target_customer_id) ?? [];
    arr.push({ message_type: m.message_type });
    smsByCustomer.set(m.target_customer_id, arr);
  }

  const readyToSendIds: string[] = [];
  for (const c of customers ?? []) {
    const status = statusMap.get(c.id);
    if (!status) continue;
    const summary = computeCustomerStatus({
      customer: c,
      status,
      reservationPayments: reservationsByCustomer.get(c.id) ?? [],
      welcomePackPayment: welcomeByCustomer.get(c.id) ?? null,
      smsMessages: smsByCustomer.get(c.id) ?? [],
    });
    if (summary.label === "강의 접수 메시지 발송 대기") {
      readyToSendIds.push(c.id);
    }
  }

  return (
    <>
      <PageHeader
        title="신규 교육생 알림"
        description="교육원별로 미발송 교육생을 묶어 원장에게 SMS를 발송합니다."
        breadcrumbs={[
          { href: "/sms", label: "알림발송" },
          { label: "신규 교육생" },
        ]}
      />
      <div className="p-6">
        <SmsNewStudentView
          centers={centers ?? []}
          customers={customers ?? []}
          classes={classes ?? []}
          sentPairs={Array.from(sentPairs)}
          readyToSendIds={readyToSendIds}
          reservationAmountByCustomer={Object.fromEntries(
            reservationAmountByCustomer
          )}
        />
      </div>
    </>
  );
}
