-- =============================================================================
-- 0012: 요양원 "제휴 종료"
--
-- training_centers 와 동일한 패턴 (0011) 으로 care_homes 에 partnership_terminated
-- 추가. true 면 리스트에서 "제휴 종료" 로 필터링. 매칭/면접 등 다른 로직에는
-- 영향 없음.
-- =============================================================================

begin;

alter table public.care_homes
  add column partnership_terminated boolean not null default false;

comment on column public.care_homes.partnership_terminated is
  '요양원 제휴 종료 여부. true 면 리스트에서 "제휴 종료" 로 필터링. 매칭 등 다른 로직에는 영향 없음.';

create index idx_care_homes_partnership_terminated
  on public.care_homes(partnership_terminated);

commit;
