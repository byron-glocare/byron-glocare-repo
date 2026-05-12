import { z } from "zod";

// =============================================================================
// 공통 변환기
// =============================================================================

/** "" → undefined → null 변환 (선택 입력 필드용) */
export const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/**
 * 베트남어 이름 전용 — ASCII 영문 대문자로 정규화 후 저장.
 *  - "Phạm Thị Dung" → "PHAM THI DUNG"
 *  - 빈 문자열 → null
 *
 * 폼 onChange 에서도 미리 변환하지만, DB 저장 시점에 다시 한 번 보장.
 */
export const asciiUpperOptionalString = z
  .string()
  .trim()
  .transform((v) => {
    if (v === "") return null;
    // Đ/đ 는 NFD 분해 안 되므로 명시적 변환
    const replaced = v.replace(/Đ/g, "D").replace(/đ/g, "d");
    return replaced
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks 제거
      .toUpperCase();
  })
  .nullable()
  .optional();

/** "" → null, 아니면 number */
export const optionalNumber = z
  .union([z.string().trim(), z.number()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  })
  .nullable()
  .optional();

// =============================================================================
// 교육원 (training_centers)
// =============================================================================

export const trainingCenterSchema = z.object({
  // code 는 서버가 자동 발급 (TC + YYMM + 순번)
  name: z.string().trim().min(1, "교육원 이름은 필수입니다."),
  region: optionalString,
  address: optionalString,
  business_number: optionalString,
  director_name: optionalString,
  phone: optionalString,
  email: optionalString,
  bank_name: optionalString,
  bank_account: optionalString,
  tuition_fee_2025: optionalNumber,
  tuition_fee_2026: optionalNumber,
  class_hours: optionalString,
  naeil_card_eligible: z.boolean().default(false),
  contract_active: z.boolean().default(false),
  partnership_terminated: z.boolean().default(false),
  deduct_reservation_by_default: z.boolean().default(true),
  website_url: optionalString,
  notes: optionalString,
});

export type TrainingCenterInput = z.input<typeof trainingCenterSchema>;
export type TrainingCenterOutput = z.output<typeof trainingCenterSchema>;

// =============================================================================
// 교육원 월별 개강 (training_classes)
// =============================================================================

export const trainingClassSchema = z.object({
  year: z.number().int().min(2020, "연도는 2020 이상").max(2100),
  month: z.number().int().min(1).max(12, "월은 1~12"),
  class_type: z.enum(["weekday", "night"]),
  start_date: optionalString,
  end_date: optionalString,
  notes: optionalString,
});

export type TrainingClassInput = z.input<typeof trainingClassSchema>;
export type TrainingClassOutput = z.output<typeof trainingClassSchema>;

// =============================================================================
// 요양원 (care_homes)
// =============================================================================

export const careHomeSchema = z.object({
  // code 는 서버가 자동 발급 (CH + YYMM + 순번)
  name: z.string().trim().min(1, "요양원 이름은 필수입니다."),
  region: optionalString,
  address: optionalString,
  director_name: optionalString,
  phone: optionalString,
  contact_person: optionalString,
  contact_phone: optionalString,
  bed_capacity: optionalString,
  partnership_notes: optionalString,
  partnership_terminated: z.boolean().default(false),
});

export type CareHomeInput = z.input<typeof careHomeSchema>;
export type CareHomeOutput = z.output<typeof careHomeSchema>;

// =============================================================================
// 교육생 (customers) — §4.2.1
// =============================================================================

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optionalIntYear = z
  .union([z.string().trim(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.floor(n) : null;
  })
  .nullable()
  .optional();

export const customerSchema = z
  .object({
    // 개인정보
    name_vi: asciiUpperOptionalString,
    name_kr: optionalString,
    address: optionalString,
    gender: z
      .union([z.enum(["남", "여"]), z.literal(""), z.null()])
      .transform((v) => (v === "" || v === null ? null : v))
      .nullable()
      .optional(),
    birth_year: optionalIntYear,
    phone: optionalString,
    email: optionalString,

    // 비자
    visa_type: optionalString,
    topik_level: optionalString,
    stay_remaining: optionalString,

    // 희망 조건
    desired_period: optionalString,
    desired_time: z
      .union([z.enum(["주간", "야간"]), z.literal(""), z.null()])
      .transform((v) => (v === "" || v === null ? null : v))
      .nullable()
      .optional(),
    desired_region: optionalString,

    // 매칭
    training_center_id: optionalString,
    training_class_id: optionalString,
    care_home_id: optionalString,

    // 일정
    // class_start_date / class_end_date 는 training_class_id 로부터 파생되며
    // 서버 액션이 자동 동기화 — 폼/클라이언트에서 직접 쓰지 않음.
    work_start_date: optionalDate,
    work_end_date: optionalDate,
    visa_change_date: optionalDate,
    interview_date: optionalDate,

    // 상품
    product_type: z
      .union([
        z.enum(["교육", "웰컴팩", "교육+웰컴팩"]),
        z.literal(""),
        z.null(),
      ])
      .transform((v) => (v === "" || v === null ? null : v))
      .nullable()
      .optional(),

    // 대기
    is_waiting: z.boolean().default(false),
    recontact_date: optionalDate,
    waiting_memo: z
      .string()
      .max(500, "메모는 500자 이하여야 합니다.")
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),

    // 종료
    termination_reason: z
      .union([
        z.enum(["요양보호사 직종변경", "귀국", "연락두절"]),
        z.literal(""),
        z.null(),
      ])
      .transform((v) => (v === "" || v === null ? null : v))
      .nullable()
      .optional(),

    // 참고용
    legacy_status: optionalString,
  })
  .refine(
    (v) => !!(v.name_kr?.trim() || v.name_vi?.trim() || v.phone?.trim()),
    { message: "이름(한국어/베트남어) 또는 전화번호 중 하나는 입력해야 합니다." }
  );

export type CustomerInput = z.input<typeof customerSchema>;
export type CustomerOutput = z.output<typeof customerSchema>;

// =============================================================================
// 상담 일지 (customer_consultations)
// =============================================================================

export const consultationSchema = z.object({
  consultation_type: z.enum(["training_center", "care_home"]),
  content_vi: optionalString,
  content_kr: optionalString,
});

export type ConsultationInput = z.input<typeof consultationSchema>;
export type ConsultationOutput = z.output<typeof consultationSchema>;

/**
 * 신규 상담 일지 입력 — 단일 content 필드.
 * 서버가 언어를 감지해 content_vi / content_kr 로 분리 저장 + tags 추출.
 */
export const consultationWriteSchema = z.object({
  customer_id: z.uuid(),
  consultation_type: z.enum(["training_center", "care_home"]),
  content: z.string().min(1, "상담 내용을 입력해주세요.").max(4000),
});

export type ConsultationWriteInput = z.input<typeof consultationWriteSchema>;

export const consultationUpdateSchema = z.object({
  consultation_id: z.uuid(),
  content: z.string().min(1, "상담 내용을 입력해주세요.").max(4000),
});

export type ConsultationUpdateInput = z.input<typeof consultationUpdateSchema>;

// =============================================================================
// 진행 단계 플래그 (customer_statuses)
// =============================================================================

export const statusFlagsSchema = z.object({
  intake_abandoned: z.boolean(),
  intake_confirmed: z.boolean(),
  study_abroad_consultation: z.boolean(),
  training_center_finding: z.boolean(),
  class_schedule_confirmation_needed: z.boolean(),
  training_reservation_abandoned: z.boolean(),
  class_intake_sms_sent: z.boolean(),
  certificate_acquired: z.boolean(),
  training_dropped: z.boolean(),
  welcome_pack_abandoned: z.boolean(),
  health_check_completed: z.boolean(),
  care_home_finding: z.boolean(),
  resume_sent: z.boolean(),
  interview_passed: z.boolean(),
});

export type StatusFlagsInput = z.input<typeof statusFlagsSchema>;

/**
 * 진행 단계 탭 전용 — customer_statuses 플래그 + customers 의
 * termination_reason / is_waiting / recontact_date / waiting_memo 를 함께 저장.
 */
export const progressStateSchema = z.object({
  flags: statusFlagsSchema,
  termination_reason: z
    .enum(["요양보호사 직종변경", "귀국", "연락두절"])
    .nullable(),
  is_waiting: z.boolean(),
  recontact_date: z.string().nullable(),
  waiting_memo: z
    .string()
    .max(500, "메모는 500자 이내로 입력하세요.")
    .nullable(),
});

export type ProgressStateInput = z.input<typeof progressStateSchema>;

// =============================================================================
// 결제 스키마 (Phase 6)
// =============================================================================

const positiveInt = z
  .union([z.string().trim(), z.number()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  });

// 예약 결제
export const reservationPaymentSchema = z.object({
  amount: positiveInt,
  payment_date: optionalDate,
  refund_amount: positiveInt.default(0),
  refund_date: optionalDate,
  refund_reason: z
    .union([
      z.enum([
        "중도탈락_매출인식",
        "교육생환급_공제없음",
        "소개비_공제",
        "교육원섭외실패_환불",
      ]),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v === "" || v === null ? null : v))
    .nullable()
    .optional(),
});

export type ReservationPaymentInput = z.input<typeof reservationPaymentSchema>;
export type ReservationPaymentOutput = z.output<typeof reservationPaymentSchema>;

// 소개비 — 0007 이후 제거 (교육원×월 단위 일괄 처리. /settlements 페이지).

// 이벤트 결제
export const eventPaymentSchema = z.object({
  event_type: z.string().min(1, "이벤트 종류를 선택하세요."),
  amount: positiveInt.default(0),
  gift_type: optionalString,
  friend_customer_id: optionalString,
  gift_given: z.boolean().default(false),
  gift_given_date: optionalDate,
});

export type EventPaymentInput = z.input<typeof eventPaymentSchema>;
export type EventPaymentOutput = z.output<typeof eventPaymentSchema>;

// 웰컴팩 결제 (3회차 upsert)
export const welcomePackPaymentSchema = z.object({
  total_price: positiveInt.default(1500000),
  discount_amount: positiveInt.default(0),
  reservation_amount: positiveInt.default(0),
  reservation_date: optionalDate,
  interim_amount: positiveInt.default(0),
  interim_date: optionalDate,
  balance_amount: positiveInt.default(0),
  balance_date: optionalDate,
  sales_reported: z.boolean().default(false),
  sales_reported_date: optionalDate,
});

export type WelcomePackPaymentInput = z.input<typeof welcomePackPaymentSchema>;
export type WelcomePackPaymentOutput = z.output<typeof welcomePackPaymentSchema>;

// =============================================================================
// 유학 — 취업 사례 (study_cases)
// =============================================================================

/**
 * hero 노출 위치 코드:
 *   '1', '2', '3', ... → 홈페이지 Hero 영역, 값 순서대로 노출
 *   'N'                → Hero 아래 Cases 그리드 (기본값)
 */
export const studyCaseSchema = z.object({
  active: z.boolean().default(true),
  tiktok_url: optionalString,
  tiktok_thumb: optionalString,
  hero: z
    .string()
    .trim()
    .transform((v) => (v === "" ? "N" : v))
    .default("N"),
  category_ko: optionalString,
  category_vi: optionalString,
  title_ko: optionalString,
  title_vi: optionalString,
  desc_ko: optionalString,
  desc_vi: optionalString,
});

export type StudyCaseInput = z.input<typeof studyCaseSchema>;
export type StudyCaseOutput = z.output<typeof studyCaseSchema>;

// =============================================================================
// 유학 — 대학교 (universities)
// =============================================================================

export const universitySchema = z.object({
  active: z.boolean().default(true),
  name_ko: z.string().trim().min(1, "대학명(한)은 필수입니다."),
  name_vi: optionalString,
  region_ko: optionalString,
  region_vi: optionalString,
  logo_url: optionalString,
  photo_url: optionalString,
  website_url: optionalString,
  desc_ko: optionalString,
  desc_vi: optionalString,
  class_days_ko: optionalString,
  class_days_vi: optionalString,
  transport_bus: z.boolean().default(false),
  transport_subway: z.boolean().default(false),
  transport_train: z.boolean().default(false),
  transport_desc_ko: optionalString,
  transport_desc_vi: optionalString,
  dormitory: z.boolean().default(false),
  dormitory_desc_ko: optionalString,
  dormitory_desc_vi: optionalString,
  strengths: optionalString,
  tags_ko: optionalString,
  tags_vi: optionalString,
  categories: optionalString,
  emoji: optionalString,
});

export type UniversityInput = z.input<typeof universitySchema>;
export type UniversityOutput = z.output<typeof universitySchema>;

// =============================================================================
// 유학 — 학과 (departments)
// =============================================================================

export const departmentSchema = z.object({
  university_id: z.number().int().positive("대학을 선택해주세요."),
  active: z.boolean().default(true),
  icon: optionalString,
  name_ko: z.string().trim().min(1, "학과명(한)은 필수입니다."),
  name_vi: optionalString,
  category: optionalString,
  degree_years: z
    .union([z.string().trim(), z.number(), z.null()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    })
    .nullable()
    .optional(),
  tuition_ko: optionalString,
  tuition_vi: optionalString,
  scholarship_ko: optionalString,
  scholarship_vi: optionalString,
  dept_url: optionalString,
  badge: optionalString,
  case_ids: optionalString,
  course: optionalString, // 'direct' | 'language' | etc
  sort_order: z
    .union([z.string().trim(), z.number()])
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return 0;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    })
    .default(0),
});

export type DepartmentInput = z.input<typeof departmentSchema>;
export type DepartmentOutput = z.output<typeof departmentSchema>;

// =============================================================================
// 유학 — 유학센터 (study_centers)
// =============================================================================

export const studyCenterSchema = z.object({
  active: z.boolean().default(true),
  flag: optionalString,
  name_ko: optionalString,
  name_vi: z.string().trim().min(1, "센터명(베)은 필수입니다."),
  city_ko: optionalString,
  city_vi: optionalString,
  address: optionalString,
  phone: optionalString,
  email: optionalString,
  desc_ko: optionalString,
  desc_vi: optionalString,
  students_ko: optionalString,
  students_vi: optionalString,
  years_ko: optionalString,
  years_vi: optionalString,
});

export type StudyCenterInput = z.input<typeof studyCenterSchema>;
export type StudyCenterOutput = z.output<typeof studyCenterSchema>;

// =============================================================================
// 유학 — SNS 채널 (study_channels)
// =============================================================================

export const studyChannelSchema = z.object({
  active: z.boolean().default(true),
  type: optionalString, // tiktok / facebook / instagram / website / youtube / kakao
  icon: optionalString,
  name_ko: optionalString,
  name_vi: optionalString,
  desc_ko: optionalString,
  desc_vi: optionalString,
  handle: optionalString,
  url: optionalString,
  sort_order: z
    .union([z.string().trim(), z.number()])
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return 0;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : 0;
    })
    .default(0),
  memo: optionalString,
});

export type StudyChannelInput = z.input<typeof studyChannelSchema>;
export type StudyChannelOutput = z.output<typeof studyChannelSchema>;

// =============================================================================
// 유학 — 상담/보험 신청 inbox status update
// =============================================================================

export const studyInboxStatusSchema = z.object({
  status: z.enum(["미확인", "연락완료", "등록완료"]),
  memo: optionalString,
});

export type StudyInboxStatusInput = z.input<typeof studyInboxStatusSchema>;
