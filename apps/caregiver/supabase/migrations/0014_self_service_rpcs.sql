-- =============================================================================
-- 0014_self_service_rpcs.sql  (caregiver 도메인)
--
-- 고객 자가 작업용 RPC (SECURITY DEFINER) — P2.5 로 customers 쓰기가 직원/서버
-- 전용이 되었으므로, 고객이 "허용된 작업만" 안전하게 하도록 함수로 노출.
--   · 앱에 service_role 키 불필요 (함수가 정의자 권한으로 RLS 우회)
--   · 항상 auth.uid() 본인 행만 대상 → 남의 데이터 불가
--   · 허용 컬럼만 갱신 → 고객이 product_type/결제/work_date 등 못 건드림
--
-- 코드 규칙: CVN + YYMM(KST) + 월별 3자리 (admin code-generator 와 동일)
-- customer_statuses 행은 customers AFTER INSERT 트리거(0001)가 자동 생성.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. create_self_customer — 가입 시 본인 customers 생성/연결 (멱등)
-- -----------------------------------------------------------------------------
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

grant execute on function public.create_self_customer(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. submit_application — 신청서 필드만 갱신 + 제출시각
-- -----------------------------------------------------------------------------
create or replace function public.submit_application(
  p_name_kr        text default null,
  p_name_vi        text default null,
  p_phone          text default null,
  p_birth_year     int  default null,
  p_address        text default null,
  p_desired_region text default null,
  p_topik_level    text default null,
  p_visa_type      text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into cid from customers where auth_user_id = uid limit 1;
  if cid is null then
    cid := public.create_self_customer(p_name_kr, p_name_vi, p_phone);
  end if;

  update customers set
    name_kr        = coalesce(p_name_kr, name_kr),
    name_vi        = coalesce(p_name_vi, name_vi),
    phone          = coalesce(p_phone, phone),
    birth_year     = coalesce(p_birth_year, birth_year),
    address        = coalesce(p_address, address),
    desired_region = coalesce(p_desired_region, desired_region),
    topik_level    = coalesce(p_topik_level, topik_level),
    visa_type      = coalesce(p_visa_type, visa_type),
    application_submitted_at = coalesce(application_submitted_at, timezone('utc', now()))
  where id = cid;
end $$;

grant execute on function public.submit_application(text, text, text, int, text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. confirm_enrollment — 교육생이 교육원·강의 배정 컨펌
-- -----------------------------------------------------------------------------
create or replace function public.confirm_enrollment()
  returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update customers
    set enrollment_confirmed_at = coalesce(enrollment_confirmed_at, timezone('utc', now()))
    where auth_user_id = uid;
end $$;

grant execute on function public.confirm_enrollment() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. set_kakao_consent — 알림톡 수신동의 토글
-- -----------------------------------------------------------------------------
create or replace function public.set_kakao_consent(p_consent boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update customers set kakao_consent = p_consent where auth_user_id = uid;
end $$;

grant execute on function public.set_kakao_consent(boolean) to authenticated;
