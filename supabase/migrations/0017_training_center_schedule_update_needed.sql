-- =============================================================================
-- 0017: 교육원 '강의 일정 업데이트 필요' (training_centers.schedule_update_needed)
--
-- 강의 일정 정보가 교육원 단위로 관리되도록 이동. 교육생의 "강의 일정 파악"
-- 은 더 이상 customer_statuses.class_schedule_confirmation_needed 토글로
-- 관리하지 않고, 교육원의 이 컬럼 + 미래 강의 존재 여부로 자동 도출 (derived).
--
-- - false (default) = 강의 일정 업데이트 완료
-- - true            = 업데이트 필요 (관리자가 강제로 마크)
--
-- backfill: 기존 customer_statuses.class_schedule_confirmation_needed=true 인
-- 교육생이 매칭된 모든 교육원의 schedule_update_needed=true 로 설정.
-- (교육원 매칭이 안 된 교육생은 활용 불가 — 자동 backfill 영향 없음)
--
-- 기존 customer_statuses.class_schedule_confirmation_needed 컬럼은 legacy 로
-- 유지 (데이터 안전). UI / cascade / AI 에서는 더 이상 사용하지 않음.
-- =============================================================================

begin;

alter table public.training_centers
  add column schedule_update_needed boolean not null default false;

comment on column public.training_centers.schedule_update_needed is
  '강의 일정 업데이트 필요 여부 (관리자 수동 토글). true 면 이 교육원에 매칭된 강의 미지정 교육생들의 "강의 일정 업데이트 완료" 가 자동으로 "필요" 로 표시됨.';

create index idx_training_centers_schedule_update_needed
  on public.training_centers(schedule_update_needed)
  where schedule_update_needed = true;

-- backfill
update public.training_centers tc
   set schedule_update_needed = true
 where exists (
   select 1
     from public.customers c
     join public.customer_statuses cs on cs.customer_id = c.id
    where c.training_center_id = tc.id
      and cs.class_schedule_confirmation_needed = true
 );

commit;
