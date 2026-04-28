-- =============================================================================
-- 0010_study_cases_hero_text.sql
--
-- study_cases.hero 를 boolean → text 로 변경.
-- 기존 0009 에서 boolean (Y/N → true/false) 으로 잡았으나 실제 원본 데이터는
-- '1', '2', 'N' 같은 위치 코드를 갖는다:
--   - '1', '2' (기타 숫자) → 홈페이지 Hero 영역, 값 순서대로 노출
--   - 'N'                  → 홈페이지 Hero 아래 Cases 그리드에 노출
--
-- 마이그레이션:
--   true  → '1' (기존에 hero 로 표시되던 행은 1순위로 가정, 운영자가 추후 조정)
--   false → 'N'
-- =============================================================================

alter table public.study_cases
  alter column hero drop default;

alter table public.study_cases
  alter column hero type text using case
    when hero = true then '1'
    when hero = false then 'N'
    else 'N'
  end;

alter table public.study_cases
  alter column hero set default 'N';

alter table public.study_cases
  alter column hero set not null;

comment on column public.study_cases.hero is
  '노출 위치: ''1''/''2''/... (Hero 영역 순서) | ''N'' (Hero 아래 Cases 그리드)';
