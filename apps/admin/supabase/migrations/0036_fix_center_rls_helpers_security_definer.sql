-- =============================================================================
-- 0036: 유학센터 RLS 헬퍼 함수를 SECURITY DEFINER 로 — 센터 로그인 복구
--
-- 증상: youstudyinkorea.com/center 로그인 시 비번이 맞아도 "Tài khoản chưa được
--   kích hoạt..."(no_access). 원인은 study_center_users 의 RLS 정책
--   users_self_read 가 study_my_org_ids() 를 호출하고, 이 함수가 다시
--   study_center_users 를 (SECURITY INVOKER 로) 조회해 RLS 재귀가 발생 → 본인 행
--   조회 자체가 실패 → 로그인 코드가 no_access 로 처리.
--   (실제 유학센터 유저가 없어 지금까지 아무도 못 겪음.)
--
-- 해법: 헬퍼 함수를 SECURITY DEFINER 로 만들어 내부 조회가 소유자 권한으로 돌게 함
--   → RLS 재적용/재귀 없음. (Supabase 의 표준 RLS 헬퍼 패턴)
--   search_path 고정으로 보안 확보.
-- =============================================================================

create or replace function public.study_my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from public.study_center_users
  where auth_user_id = auth.uid() and status = 'active';
$$;

create or replace function public.study_is_glocare_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin',
    false
  );
$$;
