/**
 * 신규 study_* 테이블 도메인 타입 (B1_schema.sql 와 1:1).
 *
 * 향후 Supabase CLI 자동 생성으로 교체 예정:
 *   `SUPABASE_ACCESS_TOKEN=xxx npx supabase gen types typescript \
 *      --project-id oczjvsxmlbuicyhheelc --schema public > src/types/database.ts`
 *
 * 그 전까지는 본 파일이 진실원. 스키마 변경 시 동기 갱신.
 */

/**
 * Json 은 database.ts 의 export 와 동일하지만, 순환 import 회피를 위해 inline 재정의.
 */
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =============================================================================
// Enums (CHECK constraints)
// =============================================================================

export type PricingModel = "per_student" | "monthly" | "percentage" | "hybrid";
export type PercentageBasis = "tuition" | "total_paid";
export type OrgStatus = "pending" | "active" | "suspended" | "closed";
export type CenterUserRole = "admin" | "user";
export type CenterUserStatus = "active" | "suspended";
export type ManagedStudentVisa = "D-4" | "D-2" | "none" | "other";
export type ManagedStudentLocation = "VN" | "KR" | "other";
export type AdmissionSpecStatus =
  | "draft"
  | "reviewing"
  | "approved"
  | "archived";
export type AdmissionProgramType =
  | "language_program"
  | "associate_2yr"
  | "bachelor_3yr_extension"
  | "bachelor_4yr";
// C4 — 단계 재정의 (결제전/서류작성중/완료/제출완료/입학/불합격/중도취소)
export type ApplicationStatus =
  | "payment_pending"
  | "preparing"
  | "docs_complete"
  | "submitted"
  | "enrolled"
  | "rejected"
  | "cancelled";
export type DocumentStatus =
  | "pending"
  | "ai_done"
  | "human_review"
  | "approved"
  | "rejected";
// C1/C2 — 모집(offering)
export type OfferingStatus = "draft" | "published" | "closed" | "archived";
/** 모집 언어 옵션 (한국어/영어/기타) — 글로케어가 offering 별로 available 지정 */
export type OfferingLanguage = "korean" | "english" | "other";
/** 거주지 옵션 (국내=한국 체류 / 해외=한국 밖) — 서류 분기용 */
export type OfferingLocation = "domestic" | "overseas";
export type ReviewerType = "ai" | "human";
export type ReviewSeverity = "info" | "warning" | "error";
export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

// =============================================================================
// 1. study_pricing_plans
// =============================================================================
export type StudyPricingPlan = {
  id: string;
  name: string;
  model: PricingModel;
  currency: string;
  per_student_fee: number | null;
  monthly_fee: number | null;
  percentage_rate: number | null;
  percentage_basis: PercentageBasis | null;
  hybrid_params: Json | null;
  notes: string | null;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 2. study_center_orgs
// =============================================================================
export type StudyCenterOrg = {
  id: string;
  /** 마스터 유학센터(study_centers, int) 와 1:1 연결 (0035). */
  study_center_id: number | null;
  name_vi: string;
  name_ko: string | null;
  country: string;
  tax_id: string | null;
  status: OrgStatus;
  pricing_plan_id: string | null;
  settlement_currency: string;
  contact_info: Json | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  deactivated_at: string | null;
};

// =============================================================================
// 3. study_center_users
// =============================================================================
export type StudyCenterUser = {
  id: string;
  org_id: string;
  auth_user_id: string;
  email: string;
  name: string;
  role: CenterUserRole;
  status: CenterUserStatus;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 4. study_managed_students
// =============================================================================
export type StudyManagedStudent = {
  id: string;
  /** 셀프가입(B2C) 학생은 null (0046). 센터 등록 학생은 org 소속. */
  org_id: string | null;
  /** 셀프가입 학생의 auth.users (0046). 센터 등록 학생은 null. */
  auth_user_id: string | null;
  /** center=유학센터 등록, self=B2C 셀프가입 (0046) */
  source: "center" | "self";
  name: string;
  dob: string | null;
  passport_no_encrypted: string | null;
  phone: string | null;
  email: string | null;
  topik_level: string | null;
  current_visa: ManagedStudentVisa | null;
  location: ManagedStudentLocation | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// 작성서류 최종본 (study_student_final_docs) — 사람이 수정한 수정본을 저장.
//   finalized_at/by = 수정본 업로드 시각/사람. submitted_at = 최종 제출(어드민 노출) 시각.
export type StudyStudentFinalDoc = {
  id: string;
  student_id: string;
  form_file_id: string;
  application_id: string;
  doc_name: string;
  file_path: string;
  file_name: string;
  size_bytes: number | null;
  finalized_by: string | null;
  finalized_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 5. study_admission_specs
//    spec_data 7 JSONB 의 내부 구조는 src/lib/admission/spec-schema.ts (zod)
// =============================================================================
export type StudyAdmissionSpec = {
  id: string;
  university_id: number; // universities.id = bigint → number
  term: string;
  admission_category: string | null;
  program_type: AdmissionProgramType;
  departments: Json;
  required_documents: Json;
  eligibility: Json;
  schedule: Json;
  tuition: Json;
  scholarships: Json;
  metadata: Json;
  source_file_url: string | null;
  ai_extraction_log: Json | null;
  // 온라인 접수 (양식 작성 대신 가이드+제출서류)
  is_online_submission: boolean;
  online_guide_url: string | null;
  online_form_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  status: AdmissionSpecStatus;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 5b-2. study_required_submissions (B5) — 직접제출 서류 (공용 + 대학별)
// =============================================================================
export type StudyRequiredSubmission = {
  id: string;
  university_id: number | null; // NULL = 공용
  base_submission_id: string | null;
  department_id: number | null;
  name_ko: string;
  name_vi: string | null;
  target_person: "self" | "father" | "mother" | "other" | null;
  target_person_note: string | null;
  sample_image_url: string | null;
  issuance_requirements: {
    issuer?: string;
    validity_days?: number;
    lead_time_days?: number;
    needs_notarization?: boolean;
    needs_translation?: boolean;
    notes?: string;
  };
  required_data_type_keys: string[];
  aliases: string[];
  // C2 — 서류 분기. 빈 배열 = 전체 적용 / 값 있으면 그 선택 학생에게만.
  applies_to_languages: OfferingLanguage[];
  applies_to_locations: OfferingLocation[];
  sort_order: number;
  is_active: boolean;
  status: "draft" | "approved" | "archived";
  source_spec_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 5b. study_admission_form_files (B4-1)
// =============================================================================
export type AdmissionFormFileKey =
  | "application_form"
  | "self_intro"
  | "study_plan"
  | "financial_pledge_form"
  | "privacy_consent"
  | "academic_record_release"
  | "recommendation_letter"
  | "health_certificate"
  | "other";

export type StudyAdmissionFormFile = {
  id: string;
  university_id: number;
  department_name: string | null;
  key: AdmissionFormFileKey;
  name_ko: string;
  file_url: string;
  file_name: string;
  size_bytes: number | null;
  mime_type: string | null;
  is_current: boolean;
  superseded_by: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  required_data_type_keys: string[];
  /** 적용 학기 (빈 배열 = 전체 학기) */
  applies_to_terms: string[];
  /** 적용 학과 id (빈 배열 = 전체 학과) */
  applies_to_department_ids: number[];
  essay_questions: Array<{
    question_ko: string;
    question_vi?: string;
    max_chars?: number;
    basis_data_type_keys: string[];
    sub_questions?: Array<{
      question_ko: string;
      question_vi: string;
      hint_vi?: string;
      data_type_key?: string;
    }>;
  }>;
  /** 원본 PDF 좌표 오버레이 — 학생 데이터 채움 위치 (0028). 빈 배열=미지정. */
  field_overlays: FormFieldOverlay[];
  /** docx 토큰 채움용 라벨→표준데이터 key 매핑 (0038). {정규화라벨: key}. */
  label_mapping: Record<string, string>;
  /** docx 빈칸(슬롯)→표준데이터 key 매핑 (0040). {빈칸인덱스: key}. "어디에" 명시. */
  slot_mapping: Record<string, string>;
  /** 서술형(자기소개서 등) 문서 여부 (0041). */
  is_essay: boolean;
  /** 서술형 섹션 목록 (0041). 각 섹션 = 한 서술형 답변(AI 작성). */
  essay_sections: EssaySection[];
  created_at: string;
  updated_at: string;
};

/** 서술형 섹션 — label(문항명)·prompt(작성지침)·basis_keys(AI 작성 기반 표준데이터). */
export type EssaySection = {
  id: string;
  label: string;
  prompt: string;
  basis_keys: string[];
};

/**
 * PDF 양식 위 한 항목을 그릴 영역 (좌하단 원점, PDF 포인트).
 *   - w,h 가 있으면 "박스 모드": (x,y)=박스 좌하단, 텍스트를 박스 안에 맞춰(축소·줄바꿈) 그림.
 *   - w,h 가 없으면 "레거시 점 모드": (x,y)=텍스트 baseline, maxWidth 만 적용.
 */
export type FormFieldOverlay = {
  /** 박스 고유 id (레거시: data_type_key 또는 "essay:N") */
  key: string;
  /** 0-based 페이지 인덱스 */
  page: number;
  /** 박스 좌하단 가로 (왼쪽에서) — 레거시 점 모드에선 baseline x */
  x: number;
  /** 박스 좌하단 세로 (아래에서) — 레거시 점 모드에선 baseline y */
  y: number;
  /** 박스 너비 pt (박스 모드) */
  w?: number;
  /** 박스 높이 pt (박스 모드) */
  h?: number;
  /** 폰트 크기 pt (기본 11, 박스보다 크면 자동 축소) */
  size?: number;
  /** (레거시) 이 폭(pt) 초과 시 자동 축소 */
  maxWidth?: number;

  /** 박스 종류 (없으면 text). */
  kind?: "text" | "image" | "signature" | "check";
  /** text 출처: student=학생데이터 / input=생성 시 입력 / static=관리자 고정 텍스트. (없으면 student) */
  source?: "student" | "input" | "static";
  /** 학생 데이터/이미지/체크의 연결 키 (data_type_key 또는 "essay:N"). */
  dataKey?: string;
  /** source=input: 생성 화면에 보일 라벨 (예: "작성일"). */
  inputLabel?: string;
  /** source=input: 입력 형식. */
  inputType?: "date" | "text";
  /** source=static: 관리자가 미리 적어둔 고정 텍스트(예: "✓", "해당"). */
  staticText?: string;
  /** source=input·inputType=date: 날짜의 일부만 출력 (년/월/일 분리 칸용). */
  datePart?: "year" | "month" | "day";
  /** kind=check: 학생 값이 이 값과 같으면 체크 (예: 성별 "male"). 빈값=truthy면 체크. */
  matchValue?: string;
};

// =============================================================================
// 5c. study_student_data_types — 표준 데이터 카탈로그 (B4-2)
// =============================================================================
export type StudentDataTypeCategory =
  | "identity"
  | "education"
  | "family"
  | "financial"
  | "language"
  | "contact"
  | "career"
  | "essay"
  | "document"
  | "other";

export type StudentDataInputType =
  | "text"
  | "long_text"
  | "date"
  | "number"
  | "select"
  | "multi_select"
  | "file"
  | "boolean"
  | "signature";

/** 표준데이터 분류 (B5): 대학/학과 정보 vs 서류작성 정보 */
export type StudentDataScope = "university_info" | "document_fill";

/** 파생(택1) 정의 (B5): selector 항목의 선택값 → 원본 항목 key 매핑 */
export type StudentDataDerivedFrom = {
  selector: string;
  map: Record<string, string>;
};

export type StudyStudentDataType = {
  id: string;
  key: string;
  label_ko: string;
  label_vi: string;
  category: StudentDataTypeCategory;
  input_type: StudentDataInputType;
  options: Array<{ value: string; label_ko: string; label_vi: string }> | null;
  hint_ko: string | null;
  hint_vi: string | null;
  is_essay_basis: boolean;
  is_default_required: boolean;
  sort_order: number;
  is_active: boolean;
  // B5 — 표준데이터 재설계 컬럼
  scope: StudentDataScope;
  aliases: string[] | null;
  // 연결성(독립/참조) — 0030, 0031(동일 제거)
  link_type: "independent" | "reference" | null;
  is_derived: boolean;
  derived_role: string | null;
  derived_from: StudentDataDerivedFrom | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 5b-3. study_student_submission_files (C5) — 학생별 제출서류 업로드 파일
// =============================================================================
export type StudyStudentSubmissionFile = {
  id: string;
  student_id: string;
  submission_id: string | null; // C6: doc_key 업로드 시 null
  doc_key: string | null; // C6: 모집요강 문서 key 기반 업로드 식별
  file_path: string;
  file_name: string;
  size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 5c. study_student_fill_links (C7) — 정보 입력 공개 링크(유효기간 토큰)
// =============================================================================
export type StudyStudentFillLink = {
  token: string;
  student_id: string;
  expires_at: string;
  revoked: boolean;
  created_by: string | null;
  created_at: string;
};

// =============================================================================
// 5d. study_student_data_values — 학생별 데이터 값 (B4-4)
// =============================================================================
export type StudyStudentDataValue = {
  id: string;
  student_id: string;
  data_type_key: string;
  value: Json;
  /** 유학센터 입력 원문(번역 전). null 이면 value 와 동일. 0045 */
  value_input: Json | null;
  filled_by: string | null;
  filled_at: string;
  updated_at: string;
};

// =============================================================================
// 5e. study_student_essay_drafts — AI 작문 결과 (B4-5)
// =============================================================================
export type EssayQuestion = {
  question_ko: string;
  question_vi?: string;
  max_chars?: number;
  basis_data_type_keys: string[];
};

export type StudyStudentEssayDraft = {
  id: string;
  student_id: string;
  form_file_id: string;
  question_index: number;
  question_ko: string;
  basis_data_keys: string[];
  generated_text: string | null;
  generated_at: string | null;
  generation_model: string | null;
  generation_usage: Json | null;
  edited_text: string | null;
  edited_at: string | null;
  edited_by: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 5f. study_offerings (C1) — 모집(큐레이션) 단위. 대학 × 학과 × 학기 + 모집수
// =============================================================================
export type StudyOffering = {
  id: string;
  university_id: number; // universities.id = bigint → number
  department_id: number; // departments.id = bigint → number
  term: string;
  intake_quota: number | null; // 학기별 모집수. published 시 필수
  available_languages: OfferingLanguage[]; // 글로케어가 제공하는 언어 옵션 (≥1)
  location_options: OfferingLocation[]; // 거주지 분기 옵션 (빈 배열 = 분기 없음)
  status: OfferingStatus;
  source_spec_id: string | null; // study_admission_specs.id (nullable)
  sort_order: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 6. study_applications
// =============================================================================
export type StudyApplication = {
  id: string;
  student_id: string;
  admission_spec_id: string;
  offering_id: string | null; // C1 — 희망 offering(대학/학과/학기)
  selected_language: OfferingLanguage | null; // C2 — 선택 언어
  selected_location: OfferingLocation | null; // C2 — 선택 거주지
  target_department_id: number | null;
  target_department_label: string | null;
  status: ApplicationStatus;
  next_action: string | null;
  next_deadline: string | null;
  created_at: string;
  updated_at: string;
  last_review_at: string | null;
  submitted_to_university_at: string | null;
  accepted_at: string | null;
  enrolled_at: string | null;
  cancelled_at: string | null;
};

// =============================================================================
// 7. study_application_documents
// =============================================================================
export type StudyApplicationDocument = {
  id: string;
  application_id: string;
  document_type: string;
  file_url: string;
  status: DocumentStatus;
  ai_review_result: Json | null;
  ai_reviewed_at: string | null;
  human_review_result: string | null;
  human_reviewer_id: string | null;
  human_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

// =============================================================================
// 8. study_review_feedback
// =============================================================================
export type StudyReviewFeedback = {
  id: string;
  document_id: string;
  reviewer_type: ReviewerType;
  reviewer_id: string | null;
  content_vi: string | null;
  content_ko: string | null;
  severity: ReviewSeverity;
  created_at: string;
  resolved_at: string | null;
};

// =============================================================================
// 9. study_timelines
// =============================================================================
export type StudyTimeline = {
  id: string;
  application_id: string;
  event_type: string;
  event_date: string;
  source_spec_field: string | null;
  notification_sent_at: string | null;
  created_at: string;
};

// =============================================================================
// 10. study_invoices
// =============================================================================
export type StudyInvoice = {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  line_items: Json;
  total_amount: number;
  currency: string;
  status: InvoiceStatus;
  tax_invoice_url: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  paid_at: string | null;
};

// =============================================================================
// 11. study_settlements
// =============================================================================
export type StudySettlement = {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  received_at: string;
  bank_reference: string | null;
  attached_proof_url: string | null;
  matched_by_admin: string | null;
  note: string | null;
  created_at: string;
};
