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
    classScheduleConfirmationNeeded: boolean;
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
    | "recontact_date"
    | "waiting_memo"
    | "termination_reason"
  >;
  status: Pick<
    CustomerStatus,
    | "intake_abandoned"
    | "intake_confirmed"
    | "study_abroad_consultation"
    | "training_center_finding"
    | "class_schedule_confirmation_needed"
    | "training_reservation_abandoned"
    | "class_intake_sms_sent"
    | "certificate_acquired"
    | "training_dropped"
    | "welcome_pack_abandoned"
    | "health_check_completed"
    | "care_home_finding"
    | "resume_sent"
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
  // 서버 timezone 과 무관하게 KST 기준 날짜 (운영 기준)
  // en-CA 로케일 → "YYYY-MM-DD" 포맷
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  const { customer, status, reservationPayments, welcomePackPayment } = inputs;

  const centerFinding = status.training_center_finding;
  const centerMatched = !!customer.training_center_id;
  const classScheduleConfirmationNeeded =
    status.class_schedule_confirmation_needed;
  const classMatched = !!customer.training_class_id;
  // 웰컴팩 예약금이 잡혀있으면 교육 예약금은 면제 → 입금된 것으로 간주.
  // (정산 로직 commission.ts 와 동일한 기준)
  const welcomePackBooked = !!welcomePackPayment?.reservation_date;
  const reservationPaid =
    welcomePackBooked ||
    reservationPayments.some((p) => notBlank(p.payment_date));
  const abandoned = status.training_reservation_abandoned;
  // 0008 이후: sms_messages 자동 판정 → 수기 플래그로 전환
  const smsSent = status.class_intake_sms_sent;

  // 4가지 모두 yes 면 완료 (사용자 정의)
  const complete = centerMatched && classMatched && reservationPaid && smsSent;

  return {
    centerFinding,
    centerMatched,
    classScheduleConfirmationNeeded,
    classMatched,
    reservationPaid,
    abandoned,
    smsSent,
    complete,
  };
}

/** §5.1.3 교육 단계 */
export function computeTraining(inputs: StatusInputs): StageSummary["training"] {
  const { customer, status } = inputs;
  const today = todayStr(inputs.today);

  // smsSent 는 trainingReservation 의 동일 플래그 (한 곳에서만 관리)
  const smsSent = status.class_intake_sms_sent;
  const dropped = status.training_dropped;
  const certificateAcquired = status.certificate_acquired;

  let phase: TimePhase | null = null;
  if (customer.class_start_date) {
    if (today < customer.class_start_date) phase = "전";
    else if (customer.class_end_date && today >= customer.class_end_date) phase = "완료";
    else phase = "중";
  }

  // 자격증 취득되면 완료 (사용자 정의)
  const complete = certificateAcquired;

  return { smsSent, phase, dropped, certificateAcquired, complete };
}

/** §5.1.4 취업 단계 */
export function computeEmployment(
  inputs: StatusInputs
): StageSummary["employment"] {
  const { customer, status, welcomePackPayment } = inputs;
  const today = todayStr(inputs.today);

  const welcomePackReservationPaid =
    !!welcomePackPayment && notBlank(welcomePackPayment.reservation_date);
  const welcomePackAbandoned = status.welcome_pack_abandoned;
  const careHomeFinding = status.care_home_finding;
  const careHomeMatched = !!customer.care_home_id;
  // 이력서 발송은 2026-04-23 이후 수동 플래그 (sms_messages 파생에서 전환)
  const resumeSent = status.resume_sent;

  let interviewPhase: "전" | "후" | null = null;
  if (customer.interview_date) {
    interviewPhase = today < customer.interview_date ? "전" : "후";
  }

  const interviewPassed = status.interview_passed;

  // 웰컴팩 대상자만 예약금 입금 요건 체크
  const welcomePackTarget =
    customer.product_type === "웰컴팩" ||
    customer.product_type === "교육+웰컴팩";
  const welcomePackRequirementMet = welcomePackTarget
    ? welcomePackReservationPaid
    : true;

  // 요양원 매칭 + 면접합격 + 웰컴팩 예약금 (대상자만) 모두 yes 면 완료
  const complete =
    careHomeMatched && interviewPassed && welcomePackRequirementMet;

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
    // 사용자가 명시적으로 "등록 = 진행" (intake_confirmed) 을 누른 경우만 완료.
    // 기초정보 핵심 충족은 그대로 전제 (이름/전화 미입력 시 의미 없음).
    complete:
      (basicInfo === "핵심" || basicInfo === "완벽") &&
      inputs.status.intake_confirmed &&
      !inputs.status.intake_abandoned &&
      !inputs.status.study_abroad_consultation,
  };

  const trainingReservation = computeTrainingReservation(inputs);
  const training = computeTraining(inputs);
  const employment = computeEmployment(inputs);
  const work = computeWork(inputs);

  const waiting = inputs.customer.is_waiting;
  const terminated = !!inputs.customer.termination_reason;

  // ---------------------------------------------------------------------------
  // 현재 단계 결정 — 우선순위 cascade
  //
  // 각 단계 안의 세부 라벨은 "체크포인트 순서상 미완료인 것" 중 가장 나중
  // 위치의 것을 보여준다. 포기/드랍 등 터미널 플래그는 화면상 스위치 위치가
  // 체크포인트 체인의 중간/아래에 있더라도 판정 로직에서는 해당 단계의
  // 최고 우선순위로 동작 (ON = 그 단계 즉시 종료).
  // ---------------------------------------------------------------------------
  const isWelcomePackTarget =
    inputs.customer.product_type === "웰컴팩" ||
    inputs.customer.product_type === "교육+웰컴팩";

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
    label = `접수중 · 기초정보 ${basicInfo}`;
  } else if (training.dropped) {
    currentStage = "종료";
    label = "교육 드랍";
  } else if (work.workPhase === "종료") {
    currentStage = "근무종료";
    label = "근무 종료";
  } else if (work.workPhase === "중") {
    currentStage = "근무중";
    label = `근무 중 · 비자변경 ${work.visaChangePhase ?? "—"}`;
  } else if (
    employment.complete &&
    training.certificateAcquired &&
    inputs.customer.product_type !== "교육"
  ) {
    // 취업 단계의 모든 체크포인트가 충족됐지만 근무 시작 전
    // 단, 교육만 신청 고객은 아래 cascade 의 자동 종료 분기로 보냄
    currentStage = "취업중";
    label = "근무 시작 대기";
  } else if (training.certificateAcquired) {
    // 자격증 취득 → 취업 단계 진입
    currentStage = "취업중";
    if (inputs.customer.product_type === "교육") {
      // 교육만 신청 (웰컴팩 미신청) → 자격증 취득 = 우리 흐름 종료
      currentStage = "종료";
      label = "교육 완료 (웰컴팩 미신청)";
    } else if (isWelcomePackTarget && employment.welcomePackAbandoned) {
      currentStage = "종료";
      label = "웰컴팩 예약 포기";
    } else if (employment.careHomeFinding) {
      label = "요양원 발굴 중";
    } else if (!employment.careHomeMatched) {
      label = "요양원 매칭 필요";
    } else if (!employment.resumeSent) {
      label = "이력서 발송 대기";
    } else if (employment.interviewPhase === null) {
      label = "면접 일정 확정 필요";
    } else if (employment.interviewPhase === "전") {
      label = "면접 대기";
    } else if (!employment.interviewPassed) {
      label = "면접 결과 대기";
    } else if (
      isWelcomePackTarget &&
      !employment.welcomePackReservationPaid
    ) {
      label = "웰컴팩 예약금 입금 대기";
    } else {
      label = "취업 진행 중";
    }
  } else if (trainingReservation.complete) {
    // 교육 예약 완료 → 교육 단계 진입. 미완료 체크포인트 순서 기반 라벨.
    currentStage = "교육중";
    if (training.phase === null) {
      label = "강의일정 확인 필요";
    } else if (training.phase === "전") {
      label = "교육 대기";
    } else if (training.phase === "중") {
      label = "교육 중";
    } else {
      // 강의 종료 — 자격증 취득 대기
      label = "자격증 취득 대기";
    }
  } else {
    // 교육 예약 단계
    currentStage = "교육예약중";
    if (trainingReservation.abandoned) {
      currentStage = "종료";
      label = "교육 예약 포기";
    } else if (trainingReservation.centerFinding) {
      label = "교육원 발굴 중";
    } else if (!trainingReservation.centerMatched) {
      label = "교육원 매칭 필요";
    } else if (trainingReservation.classScheduleConfirmationNeeded) {
      // 대시보드 task bucket 카드와 동일한 라벨 사용 (수동 토글 기반)
      label = "강의 일정 확인 필요";
    } else if (!trainingReservation.classMatched) {
      label = "강의일정 확정 필요";
    } else if (!trainingReservation.reservationPaid) {
      label = "예약금 입금 대기";
    } else if (!trainingReservation.smsSent) {
      label = "강의 접수 메시지 발송 대기";
    } else {
      label = "교육 예약 완료";
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
