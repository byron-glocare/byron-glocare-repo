-- =============================================================================
-- 0016_payment_rpcs.sql  (caregiver 도메인)
--
-- 토스 결제 RPC. 보안 모델:
--   · create_payment_intent  : 금액을 서버(정의자)가 결정 → 위조 불가. authenticated 호출.
--   · record_payment_paid    : 결제 확정 기록 → service_role 만 (토스 confirm 검증 후 서버가 호출).
--   · mark_payment_va_waiting: 가상계좌 입금대기 → service_role 만.
--
-- 금액: 예약금은 고정(35k/100k). 잔금(비자수수료/최종잔금)은 welcome_pack_payments
--       (어드민이 미리 입력한 값)에서 읽음.
-- 기록: 결제 확정 시 기존 테이블(reservation_payments / welcome_pack_payments)에 자동 반영.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create_payment_intent — 결제 의도 생성 (pending) + 금액 반환
-- kind: 'education_reservation' | 'welcomepack_reservation'
--     | 'welcomepack_interim'   | 'welcomepack_balance'
-- -----------------------------------------------------------------------------
create or replace function public.create_payment_intent(p_kind text)
  returns table(order_id text, amount int)
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  amt int;
  wp  welcome_pack_payments%rowtype;
  oid text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into cid from customers where auth_user_id = uid limit 1;
  if cid is null then raise exception 'no customer'; end if;

  if p_kind = 'education_reservation' then
    amt := 35000;
  elsif p_kind = 'welcomepack_reservation' then
    amt := 100000;
  elsif p_kind in ('welcomepack_interim','welcomepack_balance') then
    select * into wp from welcome_pack_payments where customer_id = cid limit 1;
    if not found then raise exception 'welcome pack not set up'; end if;
    amt := case when p_kind = 'welcomepack_interim'
                then wp.interim_amount else wp.balance_amount end;
  else
    raise exception 'unknown kind %', p_kind;
  end if;

  if amt is null or amt <= 0 then raise exception 'invalid amount'; end if;

  oid := 'CG' || replace(gen_random_uuid()::text, '-', '');
  insert into payment_transactions (customer_id, auth_user_id, kind, amount, status, toss_order_id)
    values (cid, uid, p_kind, amt, 'pending', oid);

  order_id := oid; amount := amt; return next;
end $$;

grant execute on function public.create_payment_intent(text) to authenticated;

-- -----------------------------------------------------------------------------
-- record_payment_paid — 결제 확정 (토스 confirm 검증 후 서버가 호출)
--   payment_transactions 완료 처리 + 기존 결제 테이블에 반영.
-- -----------------------------------------------------------------------------
create or replace function public.record_payment_paid(
  p_order_id text, p_payment_key text, p_method text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  tx payment_transactions%rowtype;
  today date := (timezone('Asia/Seoul', now()))::date;
begin
  select * into tx from payment_transactions where toss_order_id = p_order_id limit 1;
  if not found then raise exception 'tx not found'; end if;
  if tx.status = 'paid' then return; end if;  -- 멱등

  update payment_transactions
    set status = 'paid', toss_payment_key = p_payment_key,
        method = p_method, paid_at = timezone('utc', now())
    where id = tx.id;

  -- 기존 결제 테이블 반영
  if tx.kind = 'education_reservation' then
    insert into reservation_payments (customer_id, amount, payment_date)
      values (tx.customer_id, tx.amount, today);

  elsif tx.kind = 'welcomepack_reservation' then
    if exists (select 1 from welcome_pack_payments where customer_id = tx.customer_id) then
      update welcome_pack_payments
        set reservation_amount = tx.amount, reservation_date = today
        where customer_id = tx.customer_id;
    else
      insert into welcome_pack_payments (customer_id, reservation_amount, reservation_date)
        values (tx.customer_id, tx.amount, today);
    end if;

  elsif tx.kind = 'welcomepack_interim' then
    update welcome_pack_payments set interim_date = today where customer_id = tx.customer_id;

  elsif tx.kind = 'welcomepack_balance' then
    update welcome_pack_payments set balance_date = today where customer_id = tx.customer_id;
  end if;
end $$;

revoke execute on function public.record_payment_paid(text, text, text) from public;
grant execute on function public.record_payment_paid(text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- mark_payment_va_waiting — 가상계좌 입금대기 (서버 호출)
-- -----------------------------------------------------------------------------
create or replace function public.mark_payment_va_waiting(
  p_order_id text, p_payment_key text, p_due timestamptz
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update payment_transactions
    set status = 'waiting_deposit', toss_payment_key = p_payment_key,
        method = 'virtual_account', va_due_date = p_due
    where toss_order_id = p_order_id and status = 'pending';
end $$;

revoke execute on function public.mark_payment_va_waiting(text, text, timestamptz) from public;
grant execute on function public.mark_payment_va_waiting(text, text, timestamptz) to service_role;
