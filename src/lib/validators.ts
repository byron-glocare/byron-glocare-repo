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
