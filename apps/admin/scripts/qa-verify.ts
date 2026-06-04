/**
 * QA 검증 스크립트 — 실제 DB (Supabase) 데이터를 읽어 핵심 로직을 검증.
 *
 * 사용:
 *   npx tsx scripts/qa-verify.mts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

import { computeCustomerStatus } from "../src/lib/customer-status";
import {
  computeSettlementSummary,
  commissionSettlementMonth,
} from "../src/lib/settlement";
import {
  computeTaskBuckets,
  computeStageDistribution,
  computeNewCustomerCounts,
} from "../src/lib/dashboard";

const today = "2026-04-22"; // QA 기준일

type Expect<T> = { actual: T; expected: T; pass: boolean; note?: string };
const results: { section: string; cases: { label: string; result: Expect<unknown> }[] }[] = [];

function eq<T>(actual: T, expected: T, note?: string): Expect<T> {
  return { actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected), note };
}

async function main() {
// -----------------------------------------------------------------------------
// 데이터 로드
// -----------------------------------------------------------------------------

const [
  { data: customers },
  { data: statuses },
  { data: reservations },
  { data: welcome },
  { data: commissions },
  { data: events },
  { data: sms },
  { data: classes },
] = await Promise.all([
  supabase.from("customers").select("*").like("code", "DUM%").order("code"),
  supabase.from("customer_statuses").select("*"),
  supabase.from("reservation_payments").select("*"),
  supabase.from("welcome_pack_payments").select("*"),
  supabase.from("commission_payments").select("*"),
  supabase.from("event_payments").select("*"),
  supabase.from("sms_messages").select("*"),
  supabase.from("training_classes").select("*"),
]);

const byCustomer = Object.fromEntries((customers ?? []).map((c) => [c.code, c]));
const statusByCustomer = Object.fromEntries(
  (statuses ?? []).map((s) => [s.customer_id, s])
);
const reservationsByCustomer = groupBy(reservations ?? [], (r) => r.customer_id);
const welcomeByCustomer = Object.fromEntries(
  (welcome ?? []).map((w) => [w.customer_id, w])
);
const commissionsByCustomer = groupBy(commissions ?? [], (c) => c.customer_id);
const eventsByCustomer = groupBy(events ?? [], (e) => e.customer_id);
const smsByCustomer = groupBy(
  (sms ?? []).filter((m) => m.target_customer_id),
  (m) => m.target_customer_id!
);
const classTypeById = Object.fromEntries(
  (classes ?? []).map((c) => [c.id, c.class_type])
);

function groupBy<T, K extends string>(arr: T[], fn: (t: T) => K): Record<K, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = fn(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

// -----------------------------------------------------------------------------
// 섹션 10: 고객별 현재 단계
// -----------------------------------------------------------------------------

const stageSection: { label: string; result: Expect<unknown> }[] = [];

function checkStage(code: string, expectedStage: string, note?: string) {
  const c = byCustomer[code];
  if (!c) {
    stageSection.push({
      label: `[${code}] 고객 없음`,
      result: eq<string>("없음", "있어야함", note),
    });
    return;
  }
  const status = statusByCustomer[c.id] ?? defaultStatus(c.id);
  const summary = computeCustomerStatus({
    customer: c,
    status,
    reservationPayments: reservationsByCustomer[c.id] ?? [],
    welcomePackPayment: welcomeByCustomer[c.id] ?? null,
    smsMessages: smsByCustomer[c.id] ?? [],
    today,
  });
  stageSection.push({
    label: `[${code}] currentStage="${summary.currentStage}" label="${summary.label}"`,
    result: eq<string>(summary.currentStage, expectedStage, note),
  });
}

// 접수 완료 후에는 교육예약중 단계로 넘어가는 것이 스펙 (접수중은 기초정보 없음/진행중 상태)
checkStage("DUM2604001", "교육예약중", "c01: 기초정보 핵심 → 교육예약중 (매칭 필요)");
checkStage("DUM2604002", "교육예약중", "c02: 접수완료 후 교육원 매칭 필요");
checkStage("DUM2604003", "종료", "c03: 접수포기");
checkStage("DUM2604004", "종료", "c04: 유학상담");
checkStage("DUM2604005", "교육예약중", "c05: 교육원 발굴 중");
checkStage("DUM2604006", "교육중", "c06: 강의 5/1 시작, 아직 전");
checkStage("DUM2604007", "교육중", "c07: 강의 4/15 ~ 7/1 중");
checkStage("DUM2604008", "취업중", "c08: 교육완료 + 자격증 + 요양원 미매칭");
checkStage("DUM2604009", "종료", "c09: 교육드랍");
checkStage("DUM2604010", "취업중", "c10: 요양원 발굴 중");
checkStage("DUM2604011", "취업중", "c11: 요양원 매칭, 면접 전");
checkStage("DUM2604012", "취업중", "c12: 면접 합격, 근무 대기");
checkStage("DUM2604013", "근무중", "c13: 근무 중");
// c14: work_end_date 없음 → 근무 계속 중, visa_change_date 있어 "완료" 라벨만 붙음
checkStage("DUM2604014", "근무중", "c14: 근무 중(완료 아님) · 비자변경 완료");
checkStage("DUM2604015", "대기중", "c15: is_waiting");
checkStage("DUM2604016", "종료", "c16: 귀국");
checkStage("DUM2604017", "종료", "c17: 직종변경");

results.push({ section: "§10 고객별 현재 단계", cases: stageSection });

// -----------------------------------------------------------------------------
// 섹션 10: 정산 상태
// -----------------------------------------------------------------------------

const settlementSection: { label: string; result: Expect<unknown> }[] = [];

function checkSettlement(
  code: string,
  expected: { reservation: string; commission: string; event: string; welcomePack: string }
) {
  const c = byCustomer[code];
  if (!c) return;
  const summary = computeSettlementSummary({
    customer: c,
    reservationPayments: reservationsByCustomer[c.id] ?? [],
    commissionPayments: commissionsByCustomer[c.id] ?? [],
    eventPayments: eventsByCustomer[c.id] ?? [],
    welcomePackPayment: welcomeByCustomer[c.id] ?? null,
  });
  settlementSection.push({
    label: `[${code}] 정산: 예약=${summary.reservation} 소개비=${summary.commission} 이벤트=${summary.event} 웰컴팩=${summary.welcomePack}`,
    result: eq(summary, expected),
  });
}

checkSettlement("DUM2604001", {
  reservation: "미완료",
  commission: "미완료",
  event: "완료",
  welcomePack: "대상아님",
});
checkSettlement("DUM2604008", {
  reservation: "완료",
  commission: "미완료",
  event: "대상아님",
  welcomePack: "미완료",
});
checkSettlement("DUM2604011", {
  reservation: "미완료",
  commission: "미완료",
  event: "대상아님",
  welcomePack: "미완료",
});
checkSettlement("DUM2604012", {
  reservation: "미완료",
  commission: "미완료",
  event: "대상아님",
  welcomePack: "완료",
});

results.push({ section: "§10 정산 상태", cases: settlementSection });

// -----------------------------------------------------------------------------
// §5.3 소개비 정산 대상 월
// -----------------------------------------------------------------------------

const commissionMonthSection: { label: string; result: Expect<unknown> }[] = [];

for (const c of customers ?? []) {
  if (!c.class_start_date || !c.training_class_id) continue;
  const classType = classTypeById[c.training_class_id] ?? null;
  const m = commissionSettlementMonth(c.class_start_date, classType);
  commissionMonthSection.push({
    label: `[${c.code}] 강의시작=${c.class_start_date} (${classType}) → 정산월 ${m?.year}/${m?.month}`,
    result: { actual: null, expected: null, pass: true, note: "출력 전용" } as Expect<null>,
  });
}

results.push({ section: "§5.3 소개비 정산월 계산", cases: commissionMonthSection });

// -----------------------------------------------------------------------------
// 대시보드 작업 버킷
// -----------------------------------------------------------------------------

const buckets = computeTaskBuckets({
  customers: customers ?? [],
  statuses: statuses ?? [],
  reservationPayments: reservations ?? [],
  welcomePackPayments: welcome ?? [],
  smsMessages: sms ?? [],
  today,
});

const bucketSection = buckets.map((b) => ({
  label: `${b.label}: ${b.count}명 (${b.customers.map((c) => c.code).join(", ")})`,
  result: { actual: null, expected: null, pass: true, note: "출력 전용" } as Expect<null>,
}));

results.push({ section: "§6.2 대시보드 작업 버킷", cases: bucketSection });

// -----------------------------------------------------------------------------
// 단계 분포
// -----------------------------------------------------------------------------

const dist = computeStageDistribution({
  customers: customers ?? [],
  statuses: statuses ?? [],
  reservationPayments: reservations ?? [],
  welcomePackPayments: welcome ?? [],
  smsMessages: sms ?? [],
  today,
});

const distSection = dist.map((d) => ({
  label: `${d.stage}: ${d.count}명`,
  result: { actual: null, expected: null, pass: true, note: "출력 전용" } as Expect<null>,
}));

results.push({ section: "§6.2 단계 분포", cases: distSection });

// -----------------------------------------------------------------------------
// 신규 고객 수
// -----------------------------------------------------------------------------

const newCounts = computeNewCustomerCounts(customers ?? [], today);
results.push({
  section: "§6.2 신규 고객 수",
  cases: [
    {
      label: `오늘=${newCounts.daily} 주간=${newCounts.weekly} 월간=${newCounts.monthly}`,
      result: { actual: null, expected: null, pass: true, note: "출력 전용" } as Expect<null>,
    },
  ],
});

// -----------------------------------------------------------------------------
// DB 무결성 체크 — trigger / FK / orphan
// -----------------------------------------------------------------------------

const dbIntegrity: { label: string; result: Expect<unknown> }[] = [];

// 1. 모든 customers 에 customer_statuses 레코드가 있는가 (insert 트리거 검증)
const statusCustomerIds = new Set((statuses ?? []).map((s) => s.customer_id));
const missingStatuses = (customers ?? []).filter((c) => !statusCustomerIds.has(c.id));
dbIntegrity.push({
  label: `모든 customer 에 customer_statuses 존재 (trigger 동작) — ${missingStatuses.length}명 누락`,
  result: eq(missingStatuses.length, 0, missingStatuses.map((c) => c.code).join(",")),
});

// 2. customer_statuses 에 있는 모든 customer_id 가 customers 에 존재 (전체 비교)
const allCustomersData = await supabase.from("customers").select("id");
const allCustomerIds = new Set((allCustomersData.data ?? []).map((c) => c.id));
const allStatusesData = await supabase.from("customer_statuses").select("customer_id");
const orphanStatuses = (allStatusesData.data ?? []).filter(
  (s) => !allCustomerIds.has(s.customer_id)
);
dbIntegrity.push({
  label: `orphan customer_statuses 없음 (전체 customers 비교)`,
  result: eq(orphanStatuses.length, 0),
});

// 3. welcome_pack_payments.final_amount = total_price - discount_amount (generated column)
for (const w of welcome ?? []) {
  const expected = Math.max(0, w.total_price - w.discount_amount);
  dbIntegrity.push({
    label: `welcome_pack[${w.customer_id.slice(0, 8)}] final_amount generated 정확`,
    result: eq(w.final_amount, expected),
  });
}

// 4. 친구 소개 양방향 레코드 무결성
const friendEvents = (events ?? []).filter(
  (e) => e.event_type === "친구 소개" && e.friend_customer_id
);
for (const fe of friendEvents) {
  const reverse = friendEvents.find(
    (e) =>
      e.customer_id === fe.friend_customer_id && e.friend_customer_id === fe.customer_id
  );
  dbIntegrity.push({
    label: `친구소개 양방향 무결성 ${fe.customer_id.slice(0, 8)} ↔ ${fe.friend_customer_id?.slice(0, 8)}`,
    result: eq(!!reverse, true),
  });
}

// 5. 각 reservation_payment 의 refund_amount <= amount
for (const r of reservations ?? []) {
  if (r.refund_amount > r.amount) {
    dbIntegrity.push({
      label: `reservation_payment refund_amount(${r.refund_amount}) <= amount(${r.amount})`,
      result: eq(r.refund_amount <= r.amount, true),
    });
  }
}

// 6. commission_payments.received_amount = total_amount - deduction_amount (허용 오차 0)
for (const cp of commissions ?? []) {
  const expected = cp.total_amount - cp.deduction_amount;
  if (cp.received_amount !== null && cp.received_amount !== expected) {
    dbIntegrity.push({
      label: `commission[${cp.id.slice(0, 8)}] received_amount(${cp.received_amount}) = total(${cp.total_amount}) - deduction(${cp.deduction_amount})`,
      result: eq(cp.received_amount, expected),
    });
  }
}

// 7. 더미 데이터 개수
const dummyCustomerCount = (customers ?? []).length;
dbIntegrity.push({
  label: `더미 customers 17명 (필요 시 dummy_data.sql 투입 확인)`,
  result: eq(dummyCustomerCount, 17),
});

results.push({ section: "DB 무결성", cases: dbIntegrity });

// -----------------------------------------------------------------------------
// 출력
// -----------------------------------------------------------------------------

let totalPass = 0;
let totalFail = 0;
for (const s of results) {
  console.log(`\n■ ${s.section}`);
  for (const c of s.cases) {
    if (c.result.pass) {
      totalPass++;
      console.log(`  ✓ ${c.label}`);
    } else {
      totalFail++;
      console.log(`  ✗ ${c.label}`);
      console.log(`      actual   = ${JSON.stringify(c.result.actual)}`);
      console.log(`      expected = ${JSON.stringify(c.result.expected)}`);
      if (c.result.note) console.log(`      note     = ${c.result.note}`);
    }
  }
}

console.log(`\n=== ${totalPass} pass / ${totalFail} fail ===`);
process.exit(totalFail > 0 ? 1 : 0);

} // end main

main().catch((e) => { console.error(e); process.exit(1); });

function defaultStatus(customerId: string) {
  return {
    customer_id: customerId,
    intake_abandoned: false,
    study_abroad_consultation: false,
    training_center_finding: false,
    class_schedule_confirmation_needed: false,
    training_reservation_abandoned: false,
    certificate_acquired: false,
    training_dropped: false,
    welcome_pack_abandoned: false,
    care_home_finding: false,
    resume_sent: false,
    interview_passed: false,
    updated_at: new Date().toISOString(),
  };
}
