-- =============================================================================
-- 0081: 학기 종료 — 요강 학기(study_spec_terms)에 종료 시각 추가
--
-- 어드민이 학기를 일괄(학기 전체) 또는 개별(대학별)로 종료한다. 값이 있으면 종료, 비우면 되돌림.
-- 유학생 목록은 기본으로 진행 중인 학생만 보여준다 — 지원한 학기가 모두 종료된 학생은 빠진다.
--
-- 안전: 비어 있는 칸만 추가한다. 기존 데이터 변경 없음. 여러 번 돌려도 같다.
-- ⚠ 이 SQL 을 먼저 실행한 뒤 배포한다 — 새 코드가 이 칸을 읽는다.
-- =============================================================================

alter table public.study_spec_terms
  add column if not exists closed_at timestamptz;

-- 확인 — has_column true, closed_terms 0
select
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'study_spec_terms' and column_name = 'closed_at'
  ) as has_column,
  (select count(*) from public.study_spec_terms where closed_at is not null) as closed_terms;
