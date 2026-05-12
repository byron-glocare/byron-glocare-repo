/**
 * 대시보드 집계 순수함수.
 * 개발지시서 §6.2 "처리해야 할 작업 목록" 8종 + 단계별 고객수 + 신규 고객 수.
 */

import type {
  Customer,
  CustomerStatus,
  ReservationPayment,
  WelcomePackPayment,
  SmsMessage,
} from "@/types/database";
import { computeCustomerStatus, type StageSummary } from "./customer-status";

// =============================================================================
// 입력 묶음
// =============================================================================

export type DashboardInputs = {
  customers: Customer[];
  statuses: CustomerStatus[];
  reservationPayments: Pick<ReservationPayment, "customer_id" | "payment_date">[];
  welcomePackPayments: Pick<WelcomePackPayment, "customer_id" | "reservation_date">[];
  smsMessages: Pick<SmsMessage, "target_customer_id" | "message_type">[];
  today?: string;
};

export type TaskBucket = {
  key:
    | "center_finding"
    | "center_matching"
    | "class_matching"
    | "reservation_payment"
    | "intro_sms"
    | "care_home_finding"
    | "visa_change"
    | "recontact_needed";
  label: string;
  customers: Pick<Customer, "id" | "code" | "name_kr" | "name_vi">[];
  count: number;
};

// =============================================================================
// 유틸
// =============================================================================

function todayStr(override?: string): string {
  if (override) return override;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// 고객별 computeCustomerStatus 묶음 캐시
function enrich(inputs: DashboardInputs) {
  const statusMap = new Map(inputs.statuses.map((s) => [s.customer_id, s]));
  const reservationsByCustomer = new Map<string, typeof inputs.reservationPayments>();
  for (const r of inputs.reservationPayments) {
    const existing = reservationsByCustomer.get(r.customer_id);
    if (existing) existing.push(r);
    else reservationsByCustomer.set(r.customer_id, [r]);
  }
  const welcomeByCustomer = new Map(
    inputs.welcomePackPayments.map((w) => [w.customer_id, w])
  );
  const smsByCustomer = new Map<string, typeof inputs.smsMessages>();
  for (const m of inputs.smsMessages) {
    if (!m.target_customer_id) continue;
    const existing = smsByCustomer.get(m.target_customer_id);
    if (existing) existing.push(m);
    else smsByCustomer.set(m.target_customer_id, [m]);
  }

  return inputs.customers.map((customer) => {
    const status = statusMap.get(customer.id) ?? defaultStatus(customer.id);
    const reservationPayments = reservationsByCustomer.get(customer.id) ?? [];
    const welcomePackPayment = welcomeByCustomer.get(customer.id) ?? null;
    const smsMessages = smsByCustomer.get(customer.id) ?? [];

    const summary = computeCustomerStatus({
      customer,
      status,
      reservationPayments,
      welcomePackPayment,
      smsMessages,
      today: inputs.today,
    });
    return { customer, status, summary };
  });
}

function defaultStatus(customerId: string): CustomerStatus {
  return {
    customer_id: customerId,
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
  };
}

function pickBrief(
  c: Customer
): Pick<Customer, "id" | "code" | "name_kr" | "name_vi"> {
  return {
    id: c.id,
    code: c.code,
    name_kr: c.name_kr,
    name_vi: c.name_vi,
  };
}

// =============================================================================
// §6.2 처리해야 할 작업 8종
// =============================================================================

export function computeTaskBuckets(inputs: DashboardInputs): TaskBucket[] {
  const enriched = enrich(inputs);
  const today = todayStr(inputs.today);

  // 종료/드랍/포기 상태는 모든 작업에서 제외
  const isExcluded = (entry: ReturnType<typeof enrich>[number]) =>
    entry.summary.terminated ||
    entry.summary.training.dropped ||
    entry.status.intake_abandoned ||
    entry.status.study_abroad_consultation ||
    entry.status.training_reservation_abandoned;

  // 대기중 고객은 "연락 필요" 이외 버킷에서 제외
  const isPaused = (entry: ReturnType<typeof enrich>[number]) =>
    entry.customer.is_waiting;

  const centerFinding: Pick<Customer, "id" | "code" | "name_kr" | "name_vi">[] = [];
  const centerMatching: typeof centerFinding = [];
  const classMatching: typeof centerFinding = [];
  const reservationPayment: typeof centerFinding = [];
  const introSms: typeof centerFinding = [];
  const careHomeFinding: typeof centerFinding = [];
  const visaChange: typeof centerFinding = [];
  const recontactNeeded: typeof centerFinding = [];

  for (const e of enriched) {
    const brief = pickBrief(e.customer);
    const excluded = isExcluded(e);
    const paused = isPaused(e);

    // 교육 관련 버킷은 현재 단계가 '교육예약중' 또는 '교육중' 일 때만 활성
    const inEducationPhase =
      e.summary.currentStage === "교육예약중" ||
      e.summary.currentStage === "교육중";

    // 7-2 교육원 발굴: 플래그 on (활성/비대기)
    if (!excluded && !paused && e.status.training_center_finding) {
      centerFinding.push(brief);
    }

    // 7-3 ~ 7-6: stage label cascade 와 1:1 매칭되도록 좁힘.
    // (이전 정의는 단일 조건만 봐서 다른 라벨의 고객까지 섞여 들어갔음.)
    //
    // customer-status.ts 의 라벨 결정 순서:
    //   centerFinding → centerMatched → classScheduleConfirmationNeeded
    //   → classMatched → reservationPaid → smsSent
    // 이 cascade 의 각 "현재 미통과 지점" 이 그 카드의 정확한 모집단.
    const tr = e.summary.trainingReservation;

    // 7-3 교육원 매칭 필요 (label="교육원 매칭 필요")
    if (
      !excluded &&
      !paused &&
      inEducationPhase &&
      !e.status.training_center_finding &&
      !tr.centerMatched
    ) {
      centerMatching.push(brief);
    }

    // 7-4 강의일정 확정 필요 (label="강의일정 확정 필요")
    if (
      !excluded &&
      !paused &&
      inEducationPhase &&
      tr.centerMatched &&
      !tr.classScheduleConfirmationNeeded &&
      !tr.classMatched
    ) {
      classMatching.push(brief);
    }

    // 7-5 예약금 입금 대기 (label="예약금 입금 대기")
    if (
      !excluded &&
      !paused &&
      inEducationPhase &&
      tr.centerMatched &&
      !tr.classScheduleConfirmationNeeded &&
      tr.classMatched &&
      !tr.reservationPaid
    ) {
      reservationPayment.push(brief);
    }

    // 7-6 강의 접수 메시지 발송 대기 (label="강의 접수 메시지 발송 대기")
    if (
      !excluded &&
      !paused &&
      inEducationPhase &&
      tr.centerMatched &&
      !tr.classScheduleConfirmationNeeded &&
      tr.classMatched &&
      tr.reservationPaid &&
      !tr.smsSent
    ) {
      introSms.push(brief);
    }

    // 7-7 요양원 발굴: 플래그 on (활성/비대기)
    if (!excluded && !paused && e.status.care_home_finding) {
      careHomeFinding.push(brief);
    }

    // 7-8 비자 변경: 대기 or 중 (종료 아닌 고객만)
    if (
      !e.summary.terminated &&
      (e.summary.work.visaChangePhase === "대기" ||
        e.summary.work.visaChangePhase === "중")
    ) {
      visaChange.push(brief);
    }

    // 7-9 연락 필요: is_waiting + recontact_date <= today
    if (
      e.customer.is_waiting &&
      e.customer.recontact_date &&
      e.customer.recontact_date <= today
    ) {
      recontactNeeded.push(brief);
    }
  }

  return [
    { key: "center_finding", label: "교육원 발굴 필요", customers: centerFinding, count: centerFinding.length },
    { key: "center_matching", label: "교육원 매칭 필요", customers: centerMatching, count: centerMatching.length },
    { key: "class_matching", label: "강의일정 확정 필요", customers: classMatching, count: classMatching.length },
    { key: "reservation_payment", label: "예약금 입금 대기", customers: reservationPayment, count: reservationPayment.length },
    { key: "intro_sms", label: "강의 접수 메시지 발송", customers: introSms, count: introSms.length },
    { key: "care_home_finding", label: "요양원 발굴 필요", customers: careHomeFinding, count: careHomeFinding.length },
    { key: "visa_change", label: "비자 변경 진행", customers: visaChange, count: visaChange.length },
    { key: "recontact_needed", label: "연락 필요", customers: recontactNeeded, count: recontactNeeded.length },
  ];
}

// =============================================================================
// 진행단계별 고객 수
// =============================================================================

export type StageDistribution = {
  stage: StageSummary["currentStage"];
  count: number;
}[];

const STAGE_ORDER: StageSummary["currentStage"][] = [
  "접수중",
  "교육예약중",
  "교육중",
  "취업중",
  "근무중",
  "근무종료",
  "대기중",
  "종료",
];

export function computeStageDistribution(
  inputs: DashboardInputs
): StageDistribution {
  const enriched = enrich(inputs);
  const counts = new Map<StageSummary["currentStage"], number>();
  for (const e of enriched) {
    counts.set(e.summary.currentStage, (counts.get(e.summary.currentStage) ?? 0) + 1);
  }
  return STAGE_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((stage) => ({
    stage,
    count: counts.get(stage) ?? 0,
  }));
}

// =============================================================================
// 누적 통계 — 교육 / 자격증 / 근무
// =============================================================================

/**
 * 누적 통계 — 포기/종료 여부와 무관하게 "한 번이라도 그 단계에 도달한
 * 모든 고객" 을 카운트.
 *
 * - trained: 강의가 한 번이라도 시작된 흔적
 *     (training.phase === '중' or '완료' or training_dropped or certificate_acquired)
 *     · class_start_date 가 NULL 이지만 dropped/certified 인 데이터 누락 케이스도 포함
 * - certified: customer_statuses.certificate_acquired = true 인 수
 * - working: 현재 근무 중 (work.workPhase === '중') 인 수
 */
export function computeCumulativeCounts(
  inputs: DashboardInputs
): { trained: number; certified: number; working: number } {
  const enriched = enrich(inputs);
  let trained = 0;
  let certified = 0;
  let working = 0;
  for (const e of enriched) {
    const phase = e.summary.training.phase;
    const everStartedTraining =
      phase === "중" ||
      phase === "완료" ||
      e.status.training_dropped ||
      e.status.certificate_acquired;
    if (everStartedTraining) trained++;
    if (e.status.certificate_acquired) certified++;
    if (e.summary.work.workPhase === "중") working++;
  }
  return { trained, certified, working };
}

// =============================================================================
// 신규 고객 수 (일간/주간/월간) — 최초 등록일 기준
// =============================================================================

export function computeNewCustomerCounts(
  customers: Pick<Customer, "created_at">[],
  today?: string
): { daily: number; weekly: number; monthly: number } {
  const now = today ? new Date(today) : new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  let daily = 0;
  let weekly = 0;
  let monthly = 0;

  for (const c of customers) {
    const created = new Date(c.created_at);
    if (Number.isNaN(created.getTime())) continue;
    if (created >= dayAgo) daily++;
    if (created >= weekAgo) weekly++;
    if (created >= monthAgo) monthly++;
  }

  return { daily, weekly, monthly };
}
