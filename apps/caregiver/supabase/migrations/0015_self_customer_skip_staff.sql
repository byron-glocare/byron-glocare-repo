-- =============================================================================
-- 0015_self_customer_skip_staff.sql  (caregiver 도메인)
--
-- create_self_customer 가 직원(staff) 계정에는 고객행을 만들지 않도록 가드 추가.
--   직원이 caregiver 사이트에 로그인해도 고객으로 오염되지 않음.
--   (0014 함수 재정의 — 시그니처 동일)
-- =============================================================================
create or replace function public.create_self_customer(
  p_name_kr text default null,
  p_name_vi text default null,
  p_phone   text default null
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := auth.uid();
  existing  uuid;
  v_email   text;
  prefix    text;
  seq       int;
  new_code  text;
  new_id    uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  -- 직원 계정은 고객행 생성 안 함
  if public.is_staff() then return null; end if;

  -- 이미 연결된 고객 → 그대로 반환 (멱등)
  select id into existing from customers where auth_user_id = uid limit 1;
  if existing is not null then return existing; end if;

  -- 어드민이 먼저 만든 고객(email 일치, 미연결) → 연결
  select email into v_email from auth.users where id = uid;
  if v_email is not null then
    select id into existing from customers
      where email = v_email and auth_user_id is null limit 1;
    if existing is not null then
      update customers set auth_user_id = uid where id = existing;
      return existing;
    end if;
  end if;

  -- phone 일치(미연결) → 연결
  if p_phone is not null then
    select id into existing from customers
      where phone = p_phone and auth_user_id is null limit 1;
    if existing is not null then
      update customers set auth_user_id = uid where id = existing;
      return existing;
    end if;
  end if;

  -- 신규 생성 (코드 발급)
  prefix := 'CVN' || to_char(timezone('Asia/Seoul', now()), 'YYMM');
  select coalesce(max(nullif(substring(code from 8 for 3), '')::int), 0) + 1
    into seq from customers where code like prefix || '%';
  new_code := prefix || lpad(seq::text, 3, '0');

  insert into customers (code, auth_user_id, name_kr, name_vi, phone, email, signup_source)
    values (new_code, uid, p_name_kr, p_name_vi, p_phone, v_email, 'self')
    returning id into new_id;

  return new_id;
end $$;
