-- =============================================================================
-- 0082: 학생 단위 종료 — 유학생(study_managed_students)에 종료 시각 추가
--
-- 어드민이 학생 상세에서 학생 한 명을 종료한다. 값이 있으면 종료, 비우면 되돌림.
-- 종료된 학생은 지원·학기 상태와 상관없이 유학생 목록 기본 화면(진행 중)에서 빠진다.
-- 학생 계정·지원·서류는 그대로 둔다.
--
-- 안전: 비어 있는 칸만 추가한다. 기존 데이터 변경 없음. 여러 번 돌려도 같다.
-- ⚠ 이 SQL 을 먼저 실행한 뒤 배포한다 — 새 코드가 이 칸을 쓴다.
-- =============================================================================

alter table public.study_managed_students
  add column if not exists closed_at timestamptz;

-- 확인 — has_column true, closed_students 0
select
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'study_managed_students' and column_name = 'closed_at'
  ) as has_column,
  (select count(*) from public.study_managed_students where closed_at is not null) as closed_students;
