-- =============================================================================
-- 0011: 정산 "수금 포기" + 교육원 "제휴 종료"
--
-- 1. commission_payments.status (text) 추가:
--    - 'completed' (default) = 정상 수금 완료
--    - 'abandoned'           = 수금 포기 (정산 예정에서 제외, 별도 표시)
--    기존 row 는 모두 'completed' 로 backfill (default 적용).
--
-- 2. training_centers.partnership_terminated (boolean) 추가:
--    - false (default) = 제휴중
--    - true            = 제휴 종료
--    리스트 필터 용도. 정산/매칭 등 다른 로직에는 영향 없음.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. commission_payments.status
-- -----------------------------------------------------------------------------

alter table public.commission_payments
  add column status text not null default 'completed'
    check (status in ('completed', 'abandoned'));

comment on column public.commission_payments.status is
  '정산 row 종류: completed=정상 수금, abandoned=수금 포기 (정산 예정 목록에서 제외).';

create index idx_commission_status
  on public.commission_payments(status);

-- -----------------------------------------------------------------------------
-- 2. training_centers.partnership_terminated
-- -----------------------------------------------------------------------------

alter table public.training_centers
  add column partnership_terminated boolean not null default false;

comment on column public.training_centers.partnership_terminated is
  '교육원 제휴 종료 여부. true 면 리스트에서 "제휴 종료" 로 필터링. 정산/매칭 등 다른 로직에는 영향 없음.';

create index idx_training_centers_partnership_terminated
  on public.training_centers(partnership_terminated);

commit;
