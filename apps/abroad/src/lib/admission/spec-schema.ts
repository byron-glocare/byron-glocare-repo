/**
 * 모집요강(`study_admission_specs`)의 spec_data + metadata 검증 스키마.
 *
 * 출처: PoC Step 3 (2026-05-26) — 7건 모집요강 분석 결과 lock.
 *   - reports/admission_poc/step1_raw/ (7건)
 *   - reports/admission_poc/step2_field_inventory.md
 *
 * 구조 결정 (사용자 컨펌 2026-05-26):
 *   - 5 JSONB 컬럼 (required_documents/eligibility/schedule/tuition/scholarships) + 1 metadata JSONB
 *   - multi-department: row 1건 + departments[] JSONB (UNIQUE = university_id+term+admission_category)
 *
 * 베트남 순수외국인 필터: 다른 국적/카테고리 전용 정보는 추출 단계에서 생략.
 */

import { z } from "zod";

// ============================================================
// 1. Enums & Primitives
// ============================================================

export const programTypeEnum = z.enum([
  "language_program",          // 어학연수 (D-4)
  "associate_2yr",             // 전문학사 2년
  "bachelor_3yr_extension",    // 전공심화 학사연계 (2+2 / 3년)
  "bachelor_4yr",              // 학사 4년
]);

export const admissionTermSchema = z
  .string()
  .regex(/^\d{4}-(Spring|Fall|Summer|Winter|Year)$/, "YYYY-Spring|Fall|Summer|Winter|Year");

export const notarizationEnum = z.enum([
  "none",
  "translation_notarization",   // 번역 공증
  "consul",                     // 한국대사관 영사확인 (일반)
  "consul_for_vietnam",         // 주베트남 한국대사관 영사확인 (베트남 = 아포스티유 미가입)
  "apostille",                  // 아포스티유 (가입국)
  "apostille_or_consul",        // 둘 중 택1
]);

export const documentLanguageEnum = z.enum(["ko", "en", "vi", "ko_or_en", "any"]);

export const studentDocumentTypeEnum = z.enum([
  // 신원
  "photo", "passport_copy", "national_id_copy", "parents_id_copy",
  "alien_registration_card", "nationality_proof",
  // 학력
  "highschool_diploma", "highschool_transcript",
  // 가족
  "birth_certificate", "family_relations_certificate",
  // 재정
  "bank_balance", "financial_proof",
  "parents_employment_proof", "parents_income_proof",
  // 건강 (베트남=결핵 고위험국 → 사실상 필수)
  "tb_certificate", "health_certificate",
  // 학교 소정양식
  "application_form", "self_intro", "study_plan",
  "financial_pledge_form", "privacy_consent", "academic_record_release",
  // 어학·자격
  "topik_certificate", "language_alt_certificate", "korean_proof",
  "career_certificate", "license_copy",
  // 비자
  "visa_application_form",
  // 기타
  "other",
]);

export const educationLevelEnum = z.enum([
  "high_school",
  "high_school_12yrs",
  "health_related_bachelor",
  "bachelor",
  "master",
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD");
const isoDateOrNull = isoDate.nullable();
const dateRange = z.tuple([isoDate, isoDate]);

// ============================================================
// 2. Identity & Departments (row-level + JSONB)
// ============================================================

export const identitySchema = z.object({
  university_name_ko: z.string().min(1),
  university_name_en: z.string().nullable().optional(),
  program_type: programTypeEnum,
  term: admissionTermSchema,
  admission_category: z.string().nullable().optional(),  // '순수외국인 특별전형' / '글로벌요양복지과' 등
  campus_location_ko: z.string().nullable().optional(),
});

/** 과정(학위) — 학과 레벨. 어학연수는 program_kind=language 로 구분(학위 아님). */
export const degreeEnum = z.enum([
  "associate", // 전문학사
  "bachelor",  // 학사
  "master",    // 석사
  "doctoral",  // 박사
]);

export const departmentItemSchema = z.object({
  faculty: z.string().nullable().optional(),
  name: z.string().min(1),
  track: z.string().nullable().optional(),
  // 대학 다음 단계: 어학연수(language) 또는 학위과정(degree). 기본 degree.
  program_kind: z.enum(["language", "degree"]).nullable().optional(),
  degree: degreeEnum.nullable().optional(),            // 학위과정일 때 (전문학사/학사/석사/박사)
  years: z.number().int().min(1).max(6).nullable().optional(),  // 년제 (2/3/4년제 등)
  extension_eligible: z.boolean().optional(),
  capacity: z.union([z.number().int(), z.literal("unlimited"), z.string()]).nullable().optional(),
  korean_min_topik: z.number().int().min(1).max(6).nullable().optional(),  // 학과별 분기
  english_alt_allowed: z.boolean().optional(),
  tuition_per_semester_krw: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_glocare_target: z.boolean().optional(),    // 운영자 라벨 (B+ 검토)
});

// ============================================================
// 3. required_documents JSONB
// ============================================================

/** 서류 대상자 — 이 서류가 누구 것인지 (본인/아버지/어머니/기타) */
export const documentSubjectEnum = z.enum([
  "self",   // 학생 본인
  "father", // 아버지
  "mother", // 어머니
  "other",  // 기타 (보호자·재정보증인 등 — target_person_note 로 표기)
]);

export const requiredDocumentSchema = z.object({
  key: studentDocumentTypeEnum,
  name_ko: z.string().min(1),
  name_vi: z.string().nullable().optional(),
  required: z.boolean().default(true),
  // 서류 대상자 (예: 가족관계증명서=본인, 부모 재직증명=아버지/어머니)
  target_person: documentSubjectEnum.nullable().optional(),
  target_person_note: z.string().nullable().optional(),  // target_person='other' 일 때 설명
  issuer: z.string().nullable().optional(),
  language: documentLanguageEnum.nullable().optional(),
  notarization: notarizationEnum.nullable().optional(),
  group: z.enum([
    "identity", "academic", "family", "financial",
    "university_form", "language", "visa", "other",
  ]).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ============================================================
// 4. eligibility JSONB
// ============================================================

// 각 path 마다 level / name / description 중 무엇이든 모델이 선택 가능. notes 는 null 도 허용.
const altNotes = z.string().nullable().optional();
export const koreanAlternativePathSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("sejong_institute"),
    level: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    notes: altNotes,
  }),
  z.object({
    type: z.literal("kiip"),
    level: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    notes: altNotes,
  }),
  z.object({
    type: z.literal("university_internal_test"),
    level: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    notes: altNotes,
  }),
  z.object({
    type: z.literal("korean_education_center"),
    level: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    notes: altNotes,
  }),
  z.object({
    type: z.literal("health_science_degree"),
    level: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    notes: altNotes,
  }),
  z.object({
    type: z.literal("elder_care_career"),
    level: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    notes: altNotes,
  }),
  z.object({
    type: z.literal("other"),   // 기타 대체 경로 (위 유형에 없는 것)
    level: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    notes: altNotes,
  }),
]);

export const eligibilitySchema = z.object({
  applicant_categories: z.array(z.string()).default([]),
  education_required: educationLevelEnum,
  education_paths: z.array(z.string()).optional(),
  education_exclusions: z.array(z.string()).optional(),  // 예: 검정고시·홈스쿨링 불가
  gpa_min: z.number().nullable().optional(),
  gpa_scale: z.enum(["10", "4.5", "4.0", "100"]).nullable().optional(),
  korean_proficiency: z.object({
    topik_min_default: z.number().int().min(1).max(6).nullable(),
    topik_min_by_dept_category: z.record(z.string(), z.number().int().min(1).max(6)).optional(),
    alternative_paths: z.array(koreanAlternativePathSchema).default([]),
    post_admission_requirement: z.string().nullable().optional(),
  }).optional(),
  english_proficiency: z.object({
    applies_to_departments: z.array(z.string()).optional(),
    minimums: z.object({
      TOEFL_PBT: z.number().optional(),
      TOEFL_CBT: z.number().optional(),
      TOEFL_iBT: z.number().optional(),
      IELTS: z.number().optional(),
      CEFR: z.string().optional(),
      TEPS: z.number().optional(),
      NEW_TEPS: z.number().optional(),
      DUOLINGO: z.number().optional(),
    }).optional(),
    notes: z.string().optional(),
  }).optional(),
  financial_minimum: z.object({
    amount: z.number().int().nullable().optional(),
    currency: z.string().default("KRW"),
    // 예금주: 본인(self)/부모(parent)/기타(other). guardian·financial_sponsor 는 구버전 호환용으로만 허용.
    holder_relations: z
      .array(z.enum(["self", "parent", "other", "guardian", "financial_sponsor"]))
      .default([]),
    holder_other_note: z.string().nullable().optional(),  // holder='other' 일 때 설명(보호자/재정보증인 등)
    freshness_days: z.number().int().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).nullable().optional(),
  exclusions: z.array(z.string()).optional(),
  notes_ko: z.string().optional(),
});

// ============================================================
// 5. schedule JSONB
// ============================================================

export const admissionRoundSchema = z.object({
  name: z.string(),
  application_open: isoDateOrNull,
  application_close: isoDateOrNull,
  application_close_time: z.string().optional(),
  document_submission_close: isoDateOrNull.optional(),
  interview: isoDateOrNull.optional(),
  interview_period: dateRange.optional(),
  result_announcement: isoDateOrNull,
  payment_period: dateRange.optional(),
  visa_certificate_issuance: dateRange.optional(),
});

export const scheduleSchema = z.object({
  rounds: z.array(admissionRoundSchema).default([]),
  main_enrollment_period: dateRange.optional(),
  additional_enrollment_period: dateRange.optional(),
  orientation: isoDateOrNull.optional(),
  semester_start: isoDateOrNull,
  semester_end: isoDateOrNull.optional(),
  academic_calendar: z.record(z.string(), z.object({
    start: isoDate,
    end: isoDate,
  })).optional(),  // 어학연수의 봄·여름·가을·겨울
  submission_method: z.string().optional(),
});

// ============================================================
// 6. tuition JSONB
// ============================================================

// 모델이 string("전액 환불") 또는 number(비율 0.5) 둘 다 줄 수 있음
const refundFieldSchema = z.union([z.string(), z.number()]).nullable().optional();
export const refundPolicySchema = z.looseObject({
  before_semester_start: refundFieldSchema,
  within_30_days: refundFieldSchema,
  d31_to_60_days: refundFieldSchema,
  d61_to_90_days: refundFieldSchema,
  after_90_days: refundFieldSchema,
  notes: z.string().nullable().optional(),
});

export const tuitionSchema = z.object({
  currency: z.string().default("KRW"),
  unit: z.enum(["per_semester", "per_year", "per_program", "pending"]).default("per_semester"),
  disclosure_state: z.enum(["disclosed", "pending_until_acceptance"]).default("disclosed"),
  application_fee: z.number().int().nullable().optional(),
  admission_fee: z.number().int().nullable().optional(),
  tuition_per_semester: z.number().int().nullable().optional(),
  tuition_per_year: z.number().int().nullable().optional(),
  tuition_by_faculty: z.record(z.string(), z.number().int()).optional(),
  dorm_fee: z.number().int().nullable().optional(),
  insurance_per_year: z.number().int().nullable().optional(),
  other_fees: z.array(z.object({
    name: z.string(),
    amount: z.number().int(),
    notes: z.string().optional(),
  })).optional(),
  payment_method: z.string().optional(),
  refund_policy: refundPolicySchema.optional(),
  notes: z.string().optional(),
});

// ============================================================
// 7. scholarships JSONB
// ============================================================

export const scholarshipBenefitTypeEnum = z.enum([
  "tuition_pct",
  "tuition_amount",
  "admission_fee_waiver",
  "stipend",
  "dorm",
  "policy",          // 정부 정책 혜택 (별도 government_designations 와 중복 가능, 자유 표현)
  "other",
]);

export const scholarshipSchema = z.object({
  name: z.string(),
  applies_to: z.enum(["freshman", "enrolled", "both"]).default("freshman"),
  condition: z.string(),
  benefit_type: scholarshipBenefitTypeEnum,
  benefit_value: z.union([z.number(), z.string()]).nullable().optional(),
  /** TOPIK 등급별 stepped 매트릭스: { "3": 0.30, "4": 0.40, "5": 0.50, "6": 0.60 } */
  tiered_by_topik: z.record(z.string(), z.union([z.number(), z.string()])).nullable().optional(),
  duration: z.string().nullable().optional(),
  exclusivity_with: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ============================================================
// 8. metadata JSONB (5 카테고리 밖 통합)
// ============================================================

export const selectionProcessSchema = z.object({
  method: z.string(),
  score_breakdown: z.record(z.string(), z.number()).optional(),
  total_score: z.number().int().optional(),
  pass_threshold: z.number().int().optional(),
  interview_required: z.boolean().optional(),
  interview_content: z.array(z.string()).optional(),
  evaluation_criteria: z.string().optional(),
});

export const postAcceptanceSchema = z.object({
  visa_type: z.string().default("D-2"),
  post_graduation_visa: z.string().optional(),      // E-7 등
  vn_specific_visa_documents: z.array(z.string()).optional(),
  insurance_requirement: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  process_steps: z.array(z.string()).optional(),
});

export const livingCostSchema = z.object({
  currency: z.string().default("KRW"),
  dorm_fee: z.number().int().optional(),
  dorm_fee_duration_months: z.number().int().optional(),
  dorm_deposit: z.number().int().optional(),
  dorm_deposit_refundable: z.boolean().optional(),
  pickup_fee: z.number().int().optional(),
  telecom_monthly: z.number().int().optional(),
  telecom_total: z.number().int().optional(),
  textbook_monthly: z.number().int().optional(),
  textbook_total: z.number().int().optional(),
  total_annual_estimate: z.number().int().optional(),
  dorm_info: z.object({
    name: z.string().optional(),
    location: z.string().optional(),
    capacity: z.string().optional(),
    room_types: z.string().optional(),
    priority: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
});

export const formsSchema = z.object({
  application_form: z.boolean().default(false),
  self_intro: z.boolean().default(false),
  study_plan: z.boolean().default(false),
  financial_pledge: z.boolean().default(false),
  privacy_consent: z.boolean().default(false),
  academic_record_release: z.boolean().default(false),
  notes: z.string().optional(),
});

export const contactsSchema = z.object({
  phone: z.string().optional(),
  phone_vietnamese: z.string().optional(),
  phone_korean: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional(),
  email_secondary: z.string().email().optional(),
  address_ko: z.string().optional(),
  address_en: z.string().optional(),
  website: z.string().url().optional(),
  online_apply_url: z.string().url().optional(),
  department_name: z.string().optional(),
  submission_hours: z.string().optional(),
});

export const governmentDesignationSchema = z.object({
  agency: z.enum(["moj", "mohw", "moj_mohw_joint", "moe", "other"]),
  designation_name: z.string(),
  effective_from: isoDate.optional(),
  benefits: z.array(z.enum([
    "relaxed_visa_financial",
    "relaxed_stay_extension",
    "e7_eligible_after_graduation",
    "min_wage_guaranteed",
    "job_placement",
    "other",
  ])),
  notes: z.string().optional(),
});

export const languageProgramSchema = z.object({
  hours_per_semester: z.number().int().optional(),
  hours_per_week: z.number().int().optional(),
  weeks_per_semester: z.number().int().optional(),
  weekly_schedule: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  completion_criteria: z.object({
    average_score_min: z.number().optional(),
    attendance_min_pct: z.number().optional(),
  }).optional(),
  visa_type: z.string().optional(),       // D-4
  visa_extension: z.string().optional(),
});

export const metadataSchema = z.object({
  selection_process: selectionProcessSchema.optional(),
  post_acceptance: postAcceptanceSchema.optional(),
  living_cost: livingCostSchema.optional(),
  forms: formsSchema.optional(),
  contacts: contactsSchema.optional(),
  government_designations: z.array(governmentDesignationSchema).optional(),
  country_specific_notes_vi: z.string().optional(),
  language_program: languageProgramSchema.optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================
// 9. Top-level
// ============================================================

/**
 * `study_admission_specs` 의 컬럼별 매핑:
 *   - university_id, term, admission_category, program_type, status, source_file_url, ai_extraction_log, approved_by, approved_at  → row 컬럼
 *   - identity                  → 비저장 (row 컬럼 university_name_ko 등은 별도 universities 테이블 join)
 *                                  단, program_type 은 row 컬럼으로 노출 (인덱스용)
 *   - departments               → row.departments JSONB
 *   - required_documents        → row.required_documents JSONB
 *   - eligibility               → row.eligibility JSONB
 *   - schedule                  → row.schedule JSONB
 *   - tuition                   → row.tuition JSONB
 *   - scholarships              → row.scholarships JSONB
 *   - metadata                  → row.metadata JSONB
 */
export const admissionSpecSchema = z.object({
  identity: identitySchema,
  departments: z.array(departmentItemSchema).default([]),
  required_documents: z.array(requiredDocumentSchema).default([]),
  eligibility: eligibilitySchema,
  schedule: scheduleSchema,
  tuition: tuitionSchema,
  scholarships: z.array(scholarshipSchema).default([]),
  metadata: metadataSchema.default({}),
});

export type AdmissionSpec = z.infer<typeof admissionSpecSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type DepartmentItem = z.infer<typeof departmentItemSchema>;
export type RequiredDocument = z.infer<typeof requiredDocumentSchema>;
export type Eligibility = z.infer<typeof eligibilitySchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type AdmissionRound = z.infer<typeof admissionRoundSchema>;
export type Tuition = z.infer<typeof tuitionSchema>;
export type Scholarship = z.infer<typeof scholarshipSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export type GovernmentDesignation = z.infer<typeof governmentDesignationSchema>;
