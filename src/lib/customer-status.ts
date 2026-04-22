/**
 * 고객 진행 단계 자동 판정 로직.
 * 개발지시서 §5.1 기준 — 전체 체크포인트를 pure function 으로 구현하여
 * UI/서버/테스트에서 동일한 결과를 보장한다.
 */

import type {
  Customer,
  CustomerStatus,
  ReservationPayment,
  WelcomePackPayment,
  SmsMessage,
} from "@/types/database";

// =============================================================================
// 타입
// =============================================================================

/** 기초정보 충족도 — 개발지시서 §5.1.1 */
export type BasicInfoLevel = "완벽" | "핵심" | "없음";

/** 시간 단계 판정 */
export type TimePhase = "전" | "중" | "완료";

/** 단계 요약 */
export type StageSummary = {
  /** 현재 고객이 머물러 있는 대분류 */
  currentStage:
    | "접수중"
    | "접수완료_대기"
    | "교육예약중"
    | "교육중"
    | "취업중"
    | "근무중"
    | "근무종료"
    | "대기중"
    | "종료";

  /** 현재 단계의 짧은 설명 */
  label: string;

  /** §5.1.1 접수 단계 */
  intake: {
    basicInfo: BasicInfoLevel;
    abandoned: boolean;
    studyAbroad: boolean;
    complete: boolean;
  };

  /** §5.1.2 교육 예약 단계 */
  trainingReservation: {
    centerFinding: boolean;
    centerMatched: boolean;
    classMatched: boolean;
    reservationPaid: boolean;
    abandoned: boolean;
    smsSent: boolean;
    complete: boolean;
  };

  /** §5.1.3 교육 단계 */
  training: {
    smsSent: boolean;
    phase: TimePhase | null; // null = 강의일정 정보 없음
    dropped: boolean;
    certificateAcquired: boolean;
    complete: boolean;
  };

  /** §5.1.4 취업 단계 */
  employment: {
    welcomePackReservationPaid: boolean;
    welcomePackAbandoned: boolean;
    careHomeFinding: boolean;
    careHomeMatched: boolean;
    resumeSent: boolean;
    interviewPhase: "전" | "후" | null; // null = interview_date 없음
    interviewPassed: boolean;
    complete: boolean;
  };

  /** §5.1.5 근무 단계 */
  work: {
    workPhase: "전" | "중" | "종료" | null;
    visaChangePhase: "대기" | "중" | "완료" | null;
  };

  /** §5.1.6 대기/종료 */
  waiting: boolean;
  terminated: boolean;
};

// =============================================================================
// 판정 입력 묶음
// =============================================================================

export type StatusInputs = {
  customer: Pick<
    Customer,
    | "name_vi"
    | "name_kr"
    | "phone"
    | "address"
    | "gender"
    | "birth_year"
    | "visa_type"
    | "training_center_id"
    | "training_class_id"
    | "care_home_id"
    | "class_start_date"
    | "class_end_date"
    | "work_start_date"
    | "work_end_date"
    | "visa_change_date"
    | "interview_date"
    | "product_type"
    | "is_waiting"
    | "termination_reason"
  >;
  status: Pick<
    CustomerStatus,
    | "intake_abandoned"
    | "study_abroad_consultation"
    | "training_center_finding"
    | "training_reservation_abandoned"
    | "certificate_acquired"
    | "training_dropped"
    | "welcome_pack_abandoned"
    | "care_home_finding"
    | "interview_passed"
  >;
  reservationPayments: Pick<ReservationPayment, "payment_date">[];
  welcomePackPayment: Pick<WelcomePackPayment, "reservation_date"> | null;
  smsMessages: Pick<SmsMessage, "message_type">[];
  /** 오늘 날짜 (YYYY-MM-DD) — 테스트에서 주입 가능 */
  today?: string;
};

// =============================================================================
// 유틸
// =============================================================================

function todayStr(override?: string): string {
  if (override) return override;
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function notBlank(v: string | null | undefined): boolean {
  return !!v && v.trim().length > 0;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// =============================================================================
// 개별 판정 함수
// =============================================================================

/** §5.1.1 기초정보 수집 */
export function computeBasicInfo(
  customer: StatusInputs["customer"]
): BasicInfoLevel {
  const hasNameKr = notBlank(customer.name_kr);
  const hasNameVi = notBlank(customer.name_vi);
  const hasPhone = notBlank(customer.phone);

  // 핵심: 이름(둘 중 하나) + 전화 모두 입력
  const core = (hasNameKr || hasNameVi) && hasPhone;

  // 완벽: 핵심 + 주소/성별/년생/비자 모두
  const perfect =
    core &&
    notBlank(customer.address) &&
    notBlank(customer.gender as string | null) &&
    customer.birth_year !== null &&
    notBlank(customer.visa_type);

  if (perfect) return "완벽";
  if (core) return "핵심";
  return "없음";
}

/** §5.1.2 교육 예약 단계 */
export function computeTrainingReservation(
  inputs: StatusInputs
): StageSummary["trainingReservation"] {
  const { customer, status, reservationPayments, smsMessages } = inputs;

  const centerFinding = status.training_center_finding;
  const centerMatched = !!customer.training_center_id;
  const classMatched = !!customer.training_class_id;
  const reservationPaid = reservationPayments.some((p) => notBlank(p.payment_date));
  const abandoned = status.training_reservation_abandoned;
  const smsSent = smsMessages.some((m) => m.message_type === "new_student");

  const complete =
    !centerFinding &&
    !abandoned &&
    centerMatched &&
    classMatched &&
    reservationPaid;

  return {
    centerFinding,
    centerMatched,
    classMatched,
    reservationPaid,
    abandoned,
    smsSent,
    complete,
  };
}

/** §5.1.3 교육 단계 */
export function computeTraining(inputs: StatusInputs): StageSummary["training"] {
  const { customer, status, smsMessages } = inputs;
  const today = todayStr(inputs.today);

  const smsSent = smsMessages.some((m) => m.message_type === "new_student");
  const dropped = status.training_dropped;
  const certificateAcquired = status.certificate_acquired;

  let phase: TimePhase | null = null;
  if (customer.class_start_date) {
    if (today < customer.class_start_date) phase = "전";
    else if (customer.class_end_date && today >= customer.class_end_date) phase = "완료";
    else phase = "중";
  }

  const complete =
    !dropped && smsSent && phase === "완료" && certificateAcquired;

  return { smsSent, phase, dropped, certificateAcquired, complete };
}

/** §5.1.4 취업 단계 */
export function computeEmployment(
  inputs: StatusInputs
): StageSummary["employment"] {
  const { customer, status, welcomePackPayment, smsMessages } = inputs;
  const today = todayStr(inputs.today);

  const welcomePackReservationPaid =
    !!welcomePackPayment && notBlank(welcomePackPayment.reservation_date);
  const welcomePackAbandoned = status.welcome_pack_abandoned;
  const careHomeFinding = status.care_home_finding;
  const careHomeMatched = !!customer.care_home_id;
  const resumeSent = smsMessages.some((m) => m.message_type === "resume_sent");

  let interviewPhase: "전" | "후" | null = null;
  if (customer.interview_date) {
    interviewPhase = today < customer.interview_date ? "전" : "후";
  }

  const interviewPassed = status.interview_passed;

  // 웰컴팩 대상자만 예약금 입금 요건 체크 (§11 "4-6.자체취업" 참고)
  // 상품이 '교육' 또는 null 인 고객은 웰컴팩 미구매 → 예약금 요건 제외
  const welcomePackTarget =
    customer.product_type === "웰컴팩" ||
    customer.product_type === "교육+웰컴팩";
  const welcomePackRequirementMet = welcomePackTarget
    ? welcomePackReservationPaid && !welcomePackAbandoned
    : true;

  const complete =
    !careHomeFinding &&
    careHomeMatched &&
    interviewPassed &&
    welcomePackRequirementMet;

  return {
    welcomePackReservationPaid,
    welcomePackAbandoned,
    careHomeFinding,
    careHomeMatched,
    resumeSent,
    interviewPhase,
    interviewPassed,
    complete,
  };
}

/** §5.1.5 근무 단계 */
export function computeWork(inputs: StatusInputs): StageSummary["work"] {
  const { customer } = inputs;
  const today = todayStr(inputs.today);

  let workPhase: "전" | "중" | "종료" | null = null;
  if (customer.work_start_date) {
    if (customer.work_end_date) {
      workPhase = "종료";
    } else if (today < customer.work_start_date) {
      workPhase = "전";
    } else {
      workPhase = "중";
    }
  }

  let visaChangePhase: "대기" | "중" | "완료" | null = null;
  if (customer.work_start_date) {
    const after30 = addDays(customer.work_start_date, 30);
    if (customer.visa_change_date) {
      visaChangePhase = "완료";
    } else if (today < after30) {
      visaChangePhase = "대기";
    } else {
      visaChangePhase = "중";
    }
  }

  return { workPhase, visaChangePhase };
}

// =============================================================================
// 통합 판정
// =============================================================================

export function computeCustomerStatus(inputs: StatusInputs): StageSummary {
  const basicInfo = computeBasicInfo(inputs.customer);
  const intake = {
    basicInfo,
    abandoned: inputs.status.intake_abandoned,
    studyAbroad: inputs.status.study_abroad_consultation,
    complete:
      (basicInfo === "핵심" || basicInfo === "완벽") &&
      !inputs.status.intake_abandoned &&
      !inputs.status.study_abroad_consultation,
  };

  const trainingReservation = computeTrainingReservation(inputs);
  const training = computeTraining(inputs);
  const employment = computeEmployment(inputs);
  const work = computeWork(inputs);

  const waiting = inputs.customer.is_waiting;
  const terminated = !!inputs.customer.termination_reason;

  // 현재 머물러 있는 대분류 결정 — 가장 진척된 단계 기준
  let currentStage: StageSummary["currentStage"];
  let label = "";

  if (terminated) {
    currentStage = "종료";
    label = `종료 (${inputs.customer.termination_reason})`;
  } else if (waiting) {
    currentStage = "대기중";
    label = "대기중";
  } else if (intake.abandoned) {
    currentStage = "종료";
    label = "접수 포기";
  } else if (intake.studyAbroad) {
    currentStage = "종료";
    label = "유학상담으로 전환";
  } else if (!intake.complete) {
    currentStage = "접수중";
    label = `접수중 (기초정보: ${basicInfo})`;
  } else if (training.dropped) {
    currentStage = "종료";
    label = "교육 드랍";
  } else if (work.workPhase === "종료") {
    currentStage = "근무종료";
    label = "근무 종료";
  } else if (work.workPhase === "중") {
    currentStage = "근무중";
    label = `근무 중 · 비자변경 ${work.visaChangePhase ?? "—"}`;
  } else if (employment.complete) {
    // 취업 완료 상태지만 근무 시작 안 함
    currentStage = "취업중";
    label = "취업 완료 — 근무 대기";
  } else if (training.certificateAcquired) {
    // 자격증 취득 → 취업 프로세스 진입 (강의 종료 여부 무관)
    currentStage = "취업중";
    const isWelcomePackTarget =
      inputs.customer.product_type === "웰컴팩" ||
      inputs.customer.product_type === "교육+웰컴팩";
    if (employment.careHomeFinding) {
      label = "요양원 발굴 중";
    } else if (!employment.careHomeMatched) {
      label = "요양원 매칭 필요";
    } else if (employment.interviewPhase === "전") {
      label = "면접 대기";
    } else if (employment.interviewPhase === "후" && !employment.interviewPassed) {
      label = "면접 결과 대기";
    } else if (
      isWelcomePackTarget &&
      !employment.welcomePackReservationPaid &&
      !employment.welcomePackAbandoned
    ) {
      label = "웰컴팩 예약 대기";
    } else {
      label = "취업 진행 중";
    }
  } else if (training.phase === "중") {
    currentStage = "교육중";
    label = "교육 중";
  } else if (trainingReservation.complete) {
    currentStage = "교육중";
    label = training.phase === "전" ? "교육 대기 중" : "교육 진행";
  } else {
    currentStage = "교육예약중";
    if (trainingReservation.abandoned) {
      currentStage = "종료";
      label = "교육 예약 포기";
    } else if (trainingReservation.centerFinding) {
      label = "교육원 발굴 중";
    } else if (!trainingReservation.centerMatched) {
      label = "교육원 매칭 필요";
    } else if (!trainingReservation.classMatched) {
      label = "강의일정 확정 필요";
    } else if (!trainingReservation.reservationPaid) {
      label = "예약금 입금 대기";
    } else {
      label = "교육 예약 진행 중";
    }
  }

  return {
    currentStage,
    label,
    intake,
    trainingReservation,
    training,
    employment,
    work,
    waiting,
    terminated,
  };
}
