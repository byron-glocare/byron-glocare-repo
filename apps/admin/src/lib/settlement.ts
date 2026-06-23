/**
 * 정산 계산 순수함수.
 * 개발지시서 §5.2 (정산 요약) / §5.3 (소개비 대상) / §5.4 (예약금 처리) / §5.5 (웰컴팩 계산)
 *
 * 모두 외부 의존성 없이 pure function 이라 Vitest 로 바로 검증 가능.
 */

import type {
  Customer,
  CustomerStatus,
  ReservationPayment,
  CommissionPayment,
  EventPayment,
  TrainingClass,
  WelcomePackPayment,
} from "@/types/database";

// =============================================================================
// §5.2 — 정산 상태 (확장)
//   - "완료" / "대상아님" : 공통
//   - "미완료"            : 이벤트 등 단순 미완료
//   - "정산 전"           : 정산 기한 도래 전
//   - "정산 지연"         : 정산 기한 도래 후 (= 처리 늦음)
//   - "비자변경일 미정"   : 웰컴팩 전용 (visa_change_date 가 NULL)
// =============================================================================

export type SettlementFlag =
  | "완료"
  | "미완료"
  | "정산 전"
  | "정산 지연"
  | "비자변경일 미정"
  | "대상아님";

export type SettlementSummary = {
  reservation: SettlementFlag;
  commission: SettlementFlag;
  event: SettlementFlag;
  welcomePack: SettlementFlag;
};

/** KST 기준 오늘 (YYYY-MM-DD) */
function todayKstStr(override?: string): string {
  if (override) return override;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** YYYY-MM-DD 에 N개월 더한 새 YYYY-MM-DD (overflow 자동 처리) */
function addMonthsStr(dateStr: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1 + months,
    Number(m[3])
  );
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function computeSettlementSummary(inputs: {
  customer: Pick<
    Customer,
    "product_type" | "class_start_date" | "visa_change_date"
  >;
  /** 접수/교육 예약/교육 단계 포기·드랍 판정용 */
  status?: Pick<
    CustomerStatus,
    | "intake_abandoned"
    | "study_abroad_consultation"
    | "training_reservation_abandoned"
    | "training_dropped"
  > | null;
  /** 강의 일정 — class_type 으로 정산 기한 계산 (주간 2개월, 야간 3개월) */
  trainingClass?: Pick<TrainingClass, "class_type"> | null;
  reservationPayments: Pick<ReservationPayment, "payment_date">[];
  /** commission_payments row 존재 자체가 "완료" 신호 (0007 이후 구조) */
  commissionPayments: Pick<CommissionPayment, "id">[];
  eventPayments: Pick<EventPayment, "gift_given">[];
  welcomePackPayment: Pick<WelcomePackPayment, "sales_reported"> | null;
  /** 테스트 주입용 — 오늘 (YYYY-MM-DD) */
  today?: string;
}): SettlementSummary {
  const {
    customer,
    status,
    trainingClass,
    reservationPayments,
    commissionPayments,
    eventPayments,
    welcomePackPayment,
  } = inputs;
  const today = todayKstStr(inputs.today);

  // 상품이 "웰컴팩" 단독이면 교육 미참여 → 교육 예약금/소개비는 대상 아님
  const welcomePackOnly = customer.product_type === "웰컴팩";

  // 예약금 (교육 예약금): 웰컴팩 단독이면 대상 아님
  let reservation: SettlementFlag;
  if (welcomePackOnly) {
    reservation = "대상아님";
  } else {
    reservation = reservationPayments.some((p) => notBlank(p.payment_date))
      ? "완료"
      : "미완료";
  }

  // 소개비 (확장):
  //   - 대상아님:
  //       (a) product_type 이 '교육' / '교육+웰컴팩' 가 아님 (웰컴팩 단독 / null)
  //       (b) 접수/교육 예약/교육 단계에서 포기·드랍 (intake_abandoned /
  //           study_abroad_consultation / training_reservation_abandoned /
  //           training_dropped) — 소개비 정산 자동 포기
  //   - 완료: commission_payments row 존재
  //   - 정산 전 / 지연: class_start_date + (주간 2개월 / 야간 3개월) 기준 — today
  //     와 비교 (정보 부족 시 '미완료' fallback)
  let commission: SettlementFlag;
  const commissionTarget =
    customer.product_type === "교육" ||
    customer.product_type === "교육+웰컴팩";
  const abandonedEarly =
    !!status &&
    (status.intake_abandoned ||
      status.study_abroad_consultation ||
      status.training_reservation_abandoned ||
      status.training_dropped);
  if (!commissionTarget || abandonedEarly) {
    commission = "대상아님";
  } else if (commissionPayments.length > 0) {
    commission = "완료";
  } else if (customer.class_start_date && trainingClass?.class_type) {
    const months = trainingClass.class_type === "weekday" ? 2 : 3;
    const dueDate = addMonthsStr(customer.class_start_date, months);
    commission = today < dueDate ? "정산 전" : "정산 지연";
  } else {
    // 강의 정보 부족 — 정산 기한 계산 불가
    commission = "미완료";
  }

  // 이벤트: 레코드 없으면 대상아님. 있으면 모두 gift_given 이어야 완료.
  let event: SettlementFlag;
  if (eventPayments.length === 0) {
    event = "대상아님";
  } else {
    event = eventPayments.every((e) => e.gift_given) ? "완료" : "미완료";
  }

  // 웰컴팩 (확장):
  //   - 대상아님: product_type 이 '웰컴팩' / '교육+웰컴팩' 가 아님
  //   - 완료: welcome_pack_payment.sales_reported = true
  //   - 비자변경일 미정: customer.visa_change_date 가 NULL
  //   - 정산 전 / 지연: today < visa_change_date / today >= visa_change_date
  let welcomePack: SettlementFlag;
  const welcomePackTarget =
    customer.product_type === "웰컴팩" ||
    customer.product_type === "교육+웰컴팩";
  if (!welcomePackTarget) {
    welcomePack = "대상아님";
  } else if (welcomePackPayment?.sales_reported) {
    welcomePack = "완료";
  } else if (!customer.visa_change_date) {
    welcomePack = "비자변경일 미정";
  } else if (today < customer.visa_change_date) {
    welcomePack = "정산 전";
  } else {
    welcomePack = "정산 지연";
  }

  return { reservation, commission, event, welcomePack };
}

// =============================================================================
// §5.3 — 소개비 정산 대상 선정 (월말 기준) — DEPRECATED
// 새 로직은 lib/commission.ts (offset 50/80 + 월 첫날 포맷).
// 아래는 기존 /settlements 페이지 호환을 위해 유지 (점차 제거 예정).
// =============================================================================

export function commissionSettlementMonth(
  classStartDate: string | null,
  classType: "weekday" | "night" | null
): { year: number; month: number } | null {
  if (!classStartDate || !classType) return null;

  const offsetDays = classType === "weekday" ? 50 : 80;
  const d = new Date(classStartDate);
  d.setDate(d.getDate() + offsetDays);

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  };
}

export function isCommissionSettlementTargetFor(
  classStartDate: string | null,
  classType: "weekday" | "night" | null,
  year: number,
  month: number
): boolean {
  const target = commissionSettlementMonth(classStartDate, classType);
  if (!target) return false;
  return target.year === year && target.month === month;
}

// =============================================================================
// §5.4 — 예약금 처리 드롭다운 결과를 해석
// =============================================================================

export type ReservationRefundKind =
  | "중도탈락_매출인식"
  | "교육생환급_공제없음"
  | "소개비_공제"
  | "교육원섭외실패_환불";

/** 이 예약금이 소개비에서 공제되어야 하는지 */
export function isCommissionDeduction(
  payment: Pick<ReservationPayment, "amount" | "refund_reason">
): boolean {
  // 웰컴팩 예약자(100,000원)는 공제 대상 아님 (§5.4)
  if (payment.amount === 100000) return false;
  return payment.refund_reason === "소개비_공제";
}

/** 고객 기준 누적 소개비 공제액 */
export function totalCommissionDeduction(
  payments: Pick<ReservationPayment, "amount" | "refund_reason">[]
): number {
  return payments
    .filter(isCommissionDeduction)
    .reduce((sum, p) => sum + p.amount, 0);
}

// =============================================================================
// §5.5 — 웰컴팩 결제 계산
// =============================================================================

export function computeWelcomePackAmounts(
  totalPrice: number,
  discountAmount: number,
  reservationAmount: number,
  interimAmount: number
): { finalAmount: number; balanceAmount: number } {
  const finalAmount = Math.max(0, totalPrice - discountAmount);
  const balanceAmount = Math.max(
    0,
    finalAmount - reservationAmount - interimAmount
  );
  return { finalAmount, balanceAmount };
}

/**
 * 교육원 소재지를 기준으로 잔금1(2회차) 추천 금액 판정.
 *
 * §5.5 지역 매핑 기준:
 *  - 250,000  서울 대중교통권: 서울/경기/인천
 *  - 300,000  KTX 편도 4만원 이하: 대전/충남/충북/세종
 *  - 350,000  KTX 편도 4만원 초과: 부산/대구/광주/울산/경남/경북/전남/전북/제주/강원
 *
 * region 이 비어있거나 매핑 안 되면 null (사용자 수동 선택 필요).
 */
export function suggestWelcomePackInterim(
  region: string | null | undefined
): 250000 | 300000 | 350000 | null {
  if (!region) return null;
  const r = region.trim();
  if (!r) return null;

  if (/서울|경기|인천/.test(r)) return 250000;
  if (/대전|충남|충북|세종|충청/.test(r)) return 300000;
  if (/부산|대구|광주|울산|경남|경북|전남|전북|제주|강원|경상|전라/.test(r))
    return 350000;
  return null;
}

// =============================================================================
// 유틸
// =============================================================================

function notBlank(v: string | null | undefined): boolean {
  return !!v && v.trim().length > 0;
}

// =============================================================================
// 소개비 실제 수령액 계산
//   received_amount = total_amount - deduction_amount
// =============================================================================

export function computeCommissionReceived(
  totalAmount: number,
  deductionAmount: number
): number {
  return Math.max(0, totalAmount - deductionAmount);
}
