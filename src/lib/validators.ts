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
  code: optionalString,
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
  contract_status: optionalString,
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
  code: optionalString,
  name: z.string().trim().min(1, "요양원 이름은 필수입니다."),
  region: optionalString,
  address: optionalString,
  director_name: optionalString,
  phone: optionalString,
  contact_person: optionalString,
  contact_phone: optionalString,
  bed_capacity: optionalString,
  partnership_notes: optionalString,
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
    name_vi: optionalString,
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
    class_start_date: optionalDate,
    class_end_date: optionalDate,
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

// =============================================================================
// 진행 단계 플래그 (customer_statuses)
// =============================================================================

export const statusFlagsSchema = z.object({
  intake_abandoned: z.boolean(),
  study_abroad_consultation: z.boolean(),
  training_center_finding: z.boolean(),
  training_reservation_abandoned: z.boolean(),
  certificate_acquired: z.boolean(),
  training_dropped: z.boolean(),
  welcome_pack_abandoned: z.boolean(),
  care_home_finding: z.boolean(),
  interview_passed: z.boolean(),
});

export type StatusFlagsInput = z.input<typeof statusFlagsSchema>;
