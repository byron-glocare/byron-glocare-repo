-- glocare 보안점검(2026-11-09) — 운영 DB 확인용 (읽기 전용 쿼리만. 실행해도 아무것도 바뀌지 않음)
-- Supabase 대시보드 > SQL Editor 에서 하나씩 실행

-- [Q1] "로그인만 하면 전부 허용" 정책이 남아 있는지 (C3·C4) — 결과가 나오면 그 테이블은 열려 있음
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename;

-- [Q2] 결제완료 함수를 일반 사용자가 실행할 수 있는지 (C2) — true 면 무료 결제완료 가능
select
  has_function_privilege('anon',          'public.record_payment_paid(text,text,text)', 'execute') as anon_can,
  has_function_privilege('authenticated', 'public.record_payment_paid(text,text,text)', 'execute') as authed_can,
  has_function_privilege('authenticated', 'public.mark_payment_va_waiting(text,text,timestamptz)', 'execute') as authed_va_can;

-- [Q3] 학생이 발급 주문을 수정할 수 있는 정책 (H1)
select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('study_issuance_orders','study_issuance_order_items','study_applications','study_managed_students');

-- [Q4] 직원으로 취급되는 계정 목록 — 모르는 이메일(센터·학생·고객)이 있으면 권한 회수 필요 (M)
select u.email, a.role from app_users a join auth.users u on u.id = a.auth_user_id order by 1;
select email, raw_app_meta_data->>'role' as role
from auth.users where raw_app_meta_data->>'role' like 'glocare_%' order by 1;

-- [Q5] 공개 버킷 — 개인서류 버킷(student-files 등)이 public=true 면 즉시 비공개로
select id, public from storage.buckets order by id;

-- [Q6] anon/authenticated 가 실행 가능한 SECURITY DEFINER 함수 전체 (참고)
select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as authed_can
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;
