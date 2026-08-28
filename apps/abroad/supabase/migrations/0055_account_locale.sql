-- 0055: 화면 언어를 계정에 저장
--
-- 지금은 브라우저 쿠키에만 있어서 기기를 바꾸거나 쿠키가 지워지면 초기화된다.
-- 계정에 붙여 두면 어디서 로그인해도 자기 언어로 뜬다.
--
-- 대상은 youstudyinkorea 쪽 두 계정만이다.
--   study_center_users     유학센터 담당자
--   study_managed_students 학생 (센터 등록 학생 + B2C 자유 지원 학생이 같은 테이블)
-- 어드민은 한국어 전용이라 대상이 아니다.
--
-- null = 아직 고른 적 없음 → 기본값(베트남어)으로 뜬다. 사용자가 토글을 누르면 채워진다.
-- 런타임에서 값을 읽는 건 여전히 쿠키다. 로그인할 때 계정 값으로 쿠키를 맞추고,
-- 토글을 누르면 쿠키와 계정을 함께 쓴다. 공개 페이지는 계정이 없으니 쿠키만 본다.
--
-- 멱등: 컬럼·제약이 있으면 건너뛴다.

alter table public.study_center_users
  add column if not exists locale text;

alter table public.study_managed_students
  add column if not exists locale text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'study_center_users_locale_chk'
  ) then
    alter table public.study_center_users
      add constraint study_center_users_locale_chk
      check (locale is null or locale in ('ko', 'vi'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'study_managed_students_locale_chk'
  ) then
    alter table public.study_managed_students
      add constraint study_managed_students_locale_chk
      check (locale is null or locale in ('ko', 'vi'));
  end if;
end $$;

comment on column public.study_center_users.locale is
  '화면 언어(ko/vi). null 이면 미선택 — 기본값 vi 로 표시.';
comment on column public.study_managed_students.locale is
  '화면 언어(ko/vi). null 이면 미선택 — 기본값 vi 로 표시.';

-- 확인용
-- select locale, count(*) from public.study_center_users group by locale;
-- select locale, count(*) from public.study_managed_students group by locale;
