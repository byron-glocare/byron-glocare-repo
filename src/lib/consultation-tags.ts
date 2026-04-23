/**
 * 상담 일지 태그 추출 — 데이터 모델 + Zod 스키마.
 *
 * 목적: 상담 내용에서 "이 상담이 고객의 어떤 진행 단계에 해당하는지" 를
 * 파악할 수 있는 태그를 뽑아내 customer_consultations.tags 에 저장.
 * /api/extract-tags 가 Claude Haiku 를 호출해 이 구조의 결과를 반환.
 */

import { z } from "zod";

// =============================================================================
// 진행 단계 (stage) — 고객 진행 단계와 동일한 분류
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

/** 상담 자체가 어느 창구에서 이루어졌는지 (DB 의 consultation_type 과 동일) */
export const CONSULTATION_TYPES = ["training_center", "care_home"] as const;
export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

// =============================================================================
// Claude API 응답 스키마
// =============================================================================

/**
 * Claude 가 반환할 JSON 형태.
 * - stages: 이 상담이 다루는 진행 단계. 하나 이상. 여러 단계 걸쳐 있으면 복수.
 * - tags: 구체적 키워드 (자유 텍스트, 짧은 명사구).
 *         예) "교육원 발굴 필요", "강의 일정 확인", "한국어 중급",
 *             "부산 희망", "자녀 1명", "웰컴팩 관심"
 */
export const extractedTagsSchema = z.object({
  stages: z.array(z.enum(STAGES)).min(1),
  tags: z.array(z.string().min(1).max(40)).max(12),
});

export type ExtractedTags = z.infer<typeof extractedTagsSchema>;

// =============================================================================
// API 요청 스키마
// =============================================================================

export const extractTagsRequestSchema = z.object({
  content: z.string().min(1, "상담 내용이 비어 있습니다.").max(4000),
  consultation_type: z.enum(CONSULTATION_TYPES),
});

export type ExtractTagsRequest = z.infer<typeof extractTagsRequestSchema>;
