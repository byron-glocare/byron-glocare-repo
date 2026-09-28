-- 대표님용 / 영업직원용 모바일 페이지 접근 역할 부여.
--   역할은 auth.users.raw_app_meta_data.role 로 판별 (기존 glocare_admin 과 동일 방식).
--   role 은 사용자가 못 바꾸는 서버측 메타데이터 → 로그인 게이트의 신뢰 기준.
--   ⚠ app_metadata 는 JWT 에 박히므로, 실행 후 해당 계정은 재로그인해야 반영된다.
--   ⚠ byron@ 등 기존 admin 계정은 건드리지 않는다 (admin 접근 유지).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"glocare_ceo"}'::jsonb
where email = 'ceo@glocare.co.kr';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"glocare_sales"}'::jsonb
where email = 'sales@glocare.co.kr';
