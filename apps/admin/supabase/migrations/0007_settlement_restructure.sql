-- =============================================================================
-- 0007: 정산 (소개비) 구조 재설계
--
-- 기존 commission_payments 는 "고객별 + 교육원별 + 세금계산서 수기 관리" 용도로
-- 설계됐지만, 새 흐름은:
--  - 교육원별로 월 정산서 발행
--  - 완료 = 고객 단위 row 존재 여부 (unique(customer_id))
--  - 필요한 필드: customer_id · training_center_id · settlement_month ·
--    total_amount (수강료*25%) · deduction_amount · completed_at
--
-- 기존 데이터는 더미이므로 truncate.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. commission_payments 재설계
-- -----------------------------------------------------------------------------
truncate table public.commission_payments;

alter table public.commission_payments
  drop column if exists received_amount,
  drop column if exists received_date,
  drop column if exists tax_invoice_issued,
  drop column if exists tax_invoice_date,
  drop column if exists sms_sent_at,
  drop column if exists status;

alter table public.commission_payments
  add column settlement_month date not null,
  add column completed_at timestamptz not null default timezone('utc', now());

-- 한 교육생당 완료는 한 번 (되돌리기는 delete). 재처리는 delete 후 재insert.
create unique index commission_payments_customer_unique
  on public.commission_payments(customer_id);

create index commission_payments_center_month_idx
  on public.commission_payments(training_center_id, settlement_month);

comment on column public.commission_payments.settlement_month is
  '정산이 완료 처리된 월 (YYYY-MM-01). 과거로 돌아가 정산 완료 처리할 때 유용.';

-- -----------------------------------------------------------------------------
-- 2. training_centers.deduct_reservation_by_default
-- -----------------------------------------------------------------------------
alter table public.training_centers
  add column deduct_reservation_by_default boolean not null default true;

comment on column public.training_centers.deduct_reservation_by_default is
  '이 교육원의 소개비 정산 시 교육 예약금을 기본 공제할지. ON = 공제, OFF = 공제 안함.';

-- -----------------------------------------------------------------------------
-- 3. system_settings.education_reservation_amount
-- -----------------------------------------------------------------------------
insert into public.system_settings (key, value)
values ('education_reservation_amount', '35000'::jsonb)
on conflict (key) do nothing;

commit;
