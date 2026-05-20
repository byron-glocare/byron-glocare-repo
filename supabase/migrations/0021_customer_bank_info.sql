-- =============================================================================
-- 0021: 교육생 은행 계좌 정보
--
-- customers 에 bank_name / bank_account 컬럼 추가.
-- 다른 기능과 직접 연동되지 않는 단순 기본 정보 필드.
-- =============================================================================

begin;

alter table public.customers
  add column bank_name    text,
  add column bank_account text;

comment on column public.customers.bank_name    is '은행명 (예: 신한은행)';
comment on column public.customers.bank_account is '계좌번호';

commit;
