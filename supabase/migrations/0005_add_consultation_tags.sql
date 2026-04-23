-- =============================================================================
-- 0005: customer_consultations 에 AI 추출 태그 저장
--
-- Claude API 가 상담 내용에서 추출한 키워드 (진행 단계 매핑용) 저장.
-- 형식: text[] (PostgreSQL 배열). NULL = 미분석, [] = 분석 후 태그 없음.
-- 상담 생성/수정 시 /api/analyze-consultation 호출 결과를 저장.
-- =============================================================================

alter table public.customer_consultations
  add column if not exists tags text[] default '{}';

comment on column public.customer_consultations.tags is
  'Claude API 가 추출한 상담 키워드. 진행 단계 매핑 + 고객 프로필 요약용.';

-- 태그 검색/필터 GIN 인덱스 (추후 고객 상세에서 "태그 기반 유사 상담" 조회 등)
create index if not exists idx_consultations_tags
  on public.customer_consultations using gin (tags);
