/**
 * 소개비(commission) 정산 계산 — pure 함수.
 *
 * 핵심:
 *  - 정산 예정일 = class_start_date + (weekday ? 50일 : 80일)
 *  - 총액 = training_center.tuition_fee_2026 × 25%
 *  - 공제 (교육 예약금 전액) 조건:
 *      1. 교육원이 "예약금 기본 공제" ON
 *      2. 고객이 교육 예약금 실납 (reservation_payments.payment_date IS NOT NULL)
 *      3. 고객이 웰컴팩 예약금 미납 (welcome_pack_payments.reservation_date 없음)
 *
 * UI 정산 예정 화면에서 각 고객 별 공제 금액을 수동 override 가능.
 */

import type {
  Customer,
  TrainingCenter,
  TrainingClass,
  ReservationPayment,
  WelcomePackPayment,
  CommissionPayment,
} from "@/types/database";

export const WEEKDAY_OFFSET_DAYS = 50;
export const NIGHT_OFFSET_DAYS = 80;
export const COMMISSION_RATE = 0.25;

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** "YYYY-MM-DD" → "YYYY-MM-01" (정산 월 정규화) */
export function toMonthFirstDay(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** 오늘 KST 기준 "YYYY-MM-DD" */
export function kstTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 오늘이 속한 달의 첫날 "YYYY-MM-01" */
export function kstCurrentMonthFirstDay(): string {
  return toMonthFirstDay(kstTodayIso());
}

/**
 * 교육생의 정산 예정일. class_start_date + offset.
 * class_start_date 가 없으면 null → 정산 대상 아님.
 */
export function computeSettlementDueDate(
  classStartDate: string | null,
  classType: TrainingClass["class_type"] | null
): string | null {
  if (!classStartDate) return null;
  const offset =
    classType === "night" ? NIGHT_OFFSET_DAYS : WEEKDAY_OFFSET_DAYS;
  return addDaysIso(classStartDate, offset);
}

// =============================================================================
// 대상 자격 (eligibility) 판정
// =============================================================================

export type EligibilityInputs = {
  customer: Pick<
    Customer,
    | "id"
    | "training_center_id"
    | "training_class_id"
    | "class_start_date"
    | "termination_reason"
  >;
  status?: {
    intake_abandoned: boolean;
    study_abroad_consultation: boolean;
    training_reservation_abandoned: boolean;
    training_dropped: boolean;
  } | null;
  trainingClass: Pick<TrainingClass, "class_type"> | null;
};

export type EligibilityResult =
  | { eligible: true; dueDate: string }
  | { eligible: false; reason: string };

/**
 * 정산 대상 자격 판정.
 *
 * 조건:
 *  - training_center_id + training_class_id 매칭
 *  - class_start_date 존재
 *  - 종료/포기/드랍이 아님
 */
export function checkEligibility(inputs: EligibilityInputs): EligibilityResult {
  const { customer, status, trainingClass } = inputs;

  if (!customer.training_center_id || !customer.training_class_id) {
    return { eligible: false, reason: "교육원/강의 미매칭" };
  }
  if (!customer.class_start_date) {
    return { eligible: false, reason: "강의 시작일 없음" };
  }
  if (customer.termination_reason) {
    return { eligible: false, reason: "종료 상태" };
  }
  if (status) {
    if (status.intake_abandoned) return { eligible: false, reason: "접수 포기" };
    if (status.study_abroad_consultation)
      return { eligible: false, reason: "유학상담 전환" };
    if (status.training_reservation_abandoned)
      return { eligible: false, reason: "교육 예약 포기" };
    if (status.training_dropped)
      return { eligible: false, reason: "교육 드랍" };
  }

  const due = computeSettlementDueDate(
    customer.class_start_date,
    trainingClass?.class_type ?? "weekday"
  );
  if (!due) return { eligible: false, reason: "정산 예정일 계산 불가" };

  return { eligible: true, dueDate: due };
}

// =============================================================================
// 금액 계산
// =============================================================================

export type CommissionAmountInputs = {
  center: Pick<
    TrainingCenter,
    "tuition_fee_2026" | "deduct_reservation_by_default"
  >;
  reservationPayments: Pick<ReservationPayment, "payment_date">[];
  welcomePackPayment: Pick<WelcomePackPayment, "reservation_date"> | null;
  /** system_settings.education_reservation_amount (default 35000) */
  educationReservationAmount: number;
};

export type CommissionAmount = {
  tuitionBase: number; // 수강료 × 25%
  defaultDeduction: number; // 기본 공제액 (0 or 교육예약금)
  deductionEligible: boolean; // 공제 자격 있음 (수동 override 시 참고용)
  deductionReason: string; // "교육원 OFF" / "교육 예약금 미납" / "웰컴팩 예약금으로 면제" 등
};

export function computeCommissionAmount(
  inputs: CommissionAmountInputs
): CommissionAmount {
  const tuition = inputs.center.tuition_fee_2026 ?? 0;
  const tuitionBase = Math.round(tuition * COMMISSION_RATE);

  // 공제 자격 체크
  const centerWants = inputs.center.deduct_reservation_by_default;
  if (!centerWants) {
    return {
      tuitionBase,
      defaultDeduction: 0,
      deductionEligible: false,
      deductionReason: "교육원 설정: 공제 안 함",
    };
  }

  // 웰컴팩 예약금을 냈으면 교육 예약금은 면제 → 공제 대상 아님
  if (inputs.welcomePackPayment?.reservation_date) {
    return {
      tuitionBase,
      defaultDeduction: 0,
      deductionEligible: false,
      deductionReason: "웰컴팩 예약금으로 교육 예약금 면제",
    };
  }

  // 교육 예약금 실납 여부
  const paid = inputs.reservationPayments.some(
    (r) => r.payment_date && r.payment_date.length > 0
  );
  if (!paid) {
    return {
      tuitionBase,
      defaultDeduction: 0,
      deductionEligible: false,
      deductionReason: "교육 예약금 미납",
    };
  }

  return {
    tuitionBase,
    defaultDeduction: inputs.educationReservationAmount,
    deductionEligible: true,
    deductionReason: "교육 예약금 공제",
  };
}

// =============================================================================
// 정산 예정/완료 필터
// =============================================================================

/**
 * 정산 예정 여부.
 *  - 자격 OK
 *  - commission_payments row 없음
 *  - dueDate <= 조회 기준월의 마지막 날 (default: 오늘)
 */
export function isPendingForMonth(
  dueDate: string,
  viewMonthFirstDay: string,
  alreadyCompleted: boolean
): boolean {
  if (alreadyCompleted) return false;
  // 조회 월의 마지막 날 = 다음 달 1일 - 1일
  const d = new Date(viewMonthFirstDay + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  const lastDay = d.toISOString().slice(0, 10);
  return dueDate <= lastDay;
}

/** 완료 맵 lookup — customer_id 기준 */
export function makeCompletedMap(
  completed: Pick<
    CommissionPayment,
    "customer_id" | "settlement_month" | "total_amount" | "deduction_amount"
  >[]
): Map<string, (typeof completed)[number]> {
  return new Map(completed.map((c) => [c.customer_id, c]));
}
