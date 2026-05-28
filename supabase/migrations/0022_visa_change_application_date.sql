-- =============================================================================
-- 0022: 비자 변경 접수일 추가
--
-- 기존: visa_change_date 단일 컬럼으로 비자 변경 상태 판정
-- 변경: 비자 변경 신청 / 처리 두 단계를 별도 컬럼으로 추적
--
--   - visa_change_application_date : 비자 변경 신청(접수)한 날
--   - visa_change_date             : 비자 변경이 실제로 처리된 날
--
-- 규칙 (lib/customer-status.ts 의 computeWork 와 일치):
--   - 두 컬럼 모두 work_start_date 가 있어야 의미가 있음 (validator 에서 강제)
--   - visa_change_date >= visa_change_application_date 강제 (check constraint)
--   - 기존 데이터: visa_change_date 있고 application_date 없으면 같은 값으로 백필
-- =============================================================================

begin;

alter table public.customers
  add column visa_change_application_date date;

comment on column public.customers.visa_change_application_date is
  '비자 변경 신청(접수) 일자';
comment on column public.customers.visa_change_date is
  '비자 변경이 실제로 처리된 일자';

-- 기존 데이터 백필 — 변경일만 있고 접수일 비어있으면 같은 값으로 채움
update public.customers
   set visa_change_application_date = visa_change_date
 where visa_change_date is not null
   and visa_change_application_date is null;

-- 변경일 < 접수일 모순 차단
alter table public.customers
  add constraint customers_visa_dates_order_chk
  check (
    visa_change_date is null
    or visa_change_application_date is null
    or visa_change_date >= visa_change_application_date
  );

commit;
