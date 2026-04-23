/**
 * 상담 일지 AI 분석 결과 — 데이터 모델 + Zod 스키마.
 *
 * 목적: 상담 내용에서 (1) 진행 단계 매핑용 태그 + (2) 고객 프로필/플래그
 * 업데이트 제안 을 추출. Claude Haiku 가 이 구조로 응답하고, 클라이언트가
 * 검토 다이얼로그로 사용자에게 확인을 받은 뒤 일괄 적용.
 */

import { z } from "zod";

// =============================================================================
// 진행 단계 — 고객 진행 단계와 동일한 분류
// =============================================================================

export const STAGES = [
  "접수",
  "교육 예약",
  "교육",
  "취업",
  "근무",
  "종료",
] as const;

export type Stage = (typeof STAGES)[number];

export const CONSULTATION_TYPES = ["training_center", "care_home"] as const;
export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

// =============================================================================
// 자동 추출 대상 화이트리스트
// =============================================================================

/**
 * customers 테이블에서 AI 가 상담 내용으로 업데이트 제안 가능한 필드.
 * 이름/전화/이메일/날짜 필드는 포함하지 않음 (오해석 리스크 큼).
 */
const CustomerSuggestionSchema = z
  .object({
    topik_level: z.string().min(1).max(20).nullable().optional(),
    visa_type: z.string().min(1).max(20).nullable().optional(),
    desired_region: z.string().min(1).max(30).nullable().optional(),
    desired_period: z.string().min(1).max(40).nullable().optional(),
    desired_time: z.enum(["주간", "야간"]).nullable().optional(),
    birth_year: z
      .number()
      .int()
      .min(1900)
      .max(2030)
      .nullable()
      .optional(),
  })
  .strict();

export type CustomerSuggestion = z.infer<typeof CustomerSuggestionSchema>;

/**
 * customer_statuses 에서 AI 가 상담 내용으로 ON/OFF 제안 가능한 플래그.
 */
const StatusSuggestionSchema = z
  .object({
    intake_abandoned: z.boolean().optional(),
    study_abroad_consultation: z.boolean().optional(),
    training_center_finding: z.boolean().optional(),
    class_schedule_confirmation_needed: z.boolean().optional(),
    training_reservation_abandoned: z.boolean().optional(),
    certificate_acquired: z.boolean().optional(),
    training_dropped: z.boolean().optional(),
    welcome_pack_abandoned: z.boolean().optional(),
    care_home_finding: z.boolean().optional(),
    resume_sent: z.boolean().optional(),
    interview_passed: z.boolean().optional(),
  })
  .strict();

export type StatusSuggestion = z.infer<typeof StatusSuggestionSchema>;

// =============================================================================
// Claude API 응답 스키마
// =============================================================================

/**
 * Claude 가 반환할 JSON.
 * - stages: 이 상담이 다루는 진행 단계 (1개 이상).
 * - tags: 구체 키워드 (액션/프로필/이슈 혼합, 짧은 명사구).
 * - suggestions: 상담에서 명확히 언급된 정보만. 추측 금지.
 *   - customer: 기본 정보 후보
 *   - status_flags: 수동 플래그 후보
 */
export const consultationAnalysisSchema = z.object({
  stages: z.array(z.enum(STAGES)).min(1),
  tags: z.array(z.string().min(1).max(40)).max(12),
  suggestions: z
    .object({
      customer: CustomerSuggestionSchema.default({}),
      status_flags: StatusSuggestionSchema.default({}),
    })
    .default({ customer: {}, status_flags: {} }),
});

export type ConsultationAnalysis = z.infer<typeof consultationAnalysisSchema>;

// =============================================================================
// API 요청 스키마
// =============================================================================

export const analyzeConsultationRequestSchema = z.object({
  content: z.string().min(1, "상담 내용이 비어 있습니다.").max(4000),
  consultation_type: z.enum(CONSULTATION_TYPES),
});

export type AnalyzeConsultationRequest = z.infer<
  typeof analyzeConsultationRequestSchema
>;
