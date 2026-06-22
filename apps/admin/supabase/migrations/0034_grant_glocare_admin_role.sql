-- =============================================================================
-- 0034: 어드민 권한 게이트용 역할 부여 (app_metadata.role = 'glocare_admin')
--
-- 배경: admin(3001) 로그인은 지금까지 "로그인만 되면 통과"였다(역할 체크 없음).
--   세 앱이 auth.users 를 공유하므로, 이메일/비번을 가진 유학센터 계정도
--   admin 에 로그인할 수 있었다. 이를 막기 위해 admin 코드에 권한 게이트를 추가하며,
--   판별 기준은 **이미 RLS 가 쓰는 규칙**과 동일하게 app_metadata.role='glocare_admin' 으로 통일한다.
--   (study_is_glocare_admin() = auth.jwt() -> app_metadata ->> 'role' = 'glocare_admin')
--
-- ⚠️ 락아웃 방지: 게이트 코드를 배포하기 **전에** 반드시 이 SQL 을 먼저 실행해
--   현재 내부 어드민 계정에 역할을 부여해야 한다. (안 하면 admin 전체 접근 불가)
--
-- 판별: 유학센터 담당자(study_center_users)도 아니고, 요양보호 교육생(customers)도
--   아닌 auth.users = 내부 어드민 계정으로 간주하고 역할을 부여한다.
--   + 운영자 계정(kajkaj202@gmail.com)은 명시적으로 보장.
--
-- 멱등: 여러 번 실행해도 안전(jsonb 병합). 복구도 이 SQL 재실행으로 가능.
-- =============================================================================

-- 1) 내부 어드민 계정에 역할 부여 (센터/교육생 계정 제외)
update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"role":"glocare_admin"}'::jsonb
where u.id not in (select auth_user_id from public.study_center_users)
  and u.id not in (
    select auth_user_id from public.customers where auth_user_id is not null
  );

-- 2) 운영자 계정 명시적 보장 (위 조건에서 누락될 경우 대비)
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"glocare_admin"}'::jsonb
where lower(email) = 'kajkaj202@gmail.com';

-- 확인용: 역할이 부여된 계정 목록
-- select email, raw_app_meta_data ->> 'role' as role from auth.users
--   where raw_app_meta_data ->> 'role' = 'glocare_admin';
