-- =============================================================================
-- 0080: 어드민 역할은 있는데 직원 명단(app_users)에 빠진 계정 추가
--
-- 증상(2026-10-23): wechun01@gmail.com 으로 어드민에 들어가면 대시보드가 전부 0명.
--   어드민 입장은 auth.users.app_metadata.role = 'glocare_admin' 으로 통과하지만,
--   고객(customers) 등 요양 데이터의 RLS 는 is_staff() = app_users 에 있는지 로 판단한다.
--   → 역할은 있고 명단엔 없는 계정은 화면은 열리는데 데이터가 하나도 안 보인다.
--   해당: wechun01@gmail.com, dino@glocare.co.kr (둘 다 glocare_admin, app_users 없음)
--   sales@glocare.co.kr(영업)은 /sales 가 서버 권한으로 읽으므로 넣지 않는다.
--
-- 데이터 삭제·변경 없음. 이미 있으면 건너뛴다. 여러 번 돌려도 같다.
-- =============================================================================

insert into public.app_users (auth_user_id, role)
select u.id, 'glocare_admin'
  from auth.users u
 where u.email in ('wechun01@gmail.com', 'dino@glocare.co.kr')
on conflict (auth_user_id) do nothing;

-- 확인 — glocare_admin 역할인데 명단에 없는 계정이 남았는지 (0줄이면 정상)
select u.email as missing_from_app_users
  from auth.users u
 where u.raw_app_meta_data ->> 'role' = 'glocare_admin'
   and not exists (select 1 from public.app_users a where a.auth_user_id = u.id);
