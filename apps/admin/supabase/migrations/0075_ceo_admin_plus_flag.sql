-- 대표님 계정은 admin 화면과 /ceo 모바일 페이지를 모두 써야 한다.
--   role 은 단일값이라 admin/ceo 를 동시에 못 담으므로,
--   role='glocare_admin'(admin 접근) + ceo=true 플래그(/ceo 접근)로 부여.
--   일반 admin(플래그 없음)은 /ceo 접근 불가 → "대표님만" 유지.
--   ⚠ 실행 후 ceo@ 재로그인 필요(JWT 반영).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"glocare_admin","ceo":true}'::jsonb
where email = 'ceo@glocare.co.kr';
