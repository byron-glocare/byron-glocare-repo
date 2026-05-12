-- =============================================================================
-- 0013: 접수 "등록" 수동 결정 + 취업 "건강검진 완료" 수동 플래그
--
-- 1. customer_statuses.intake_confirmed (boolean)
--    기존엔 기초정보가 입력되면 자동으로 접수 단계가 완료됐는데, 사용자가
--    명시적으로 "등록" 결정 (예/아니오) 을 누른 경우만 다음 단계로 진행.
--    UI 3-state:
--      - intake_confirmed=false AND intake_abandoned=false  → 미선택 (접수중)
--      - intake_confirmed=true                              → 진행 (다음 단계)
--      - intake_abandoned=true                              → 포기 (종료)
--    클라/서버에서 두 값이 동시에 true 가 되지 않도록 보장.
--
--    backfill: 기존 진행 중 (포기/유학상담 아님 + 기초정보 핵심) 고객은
--    intake_confirmed=true 로 채워서 운영 흐름 깨지지 않도록.
--
-- 2. customer_statuses.health_check_completed (boolean)
--    취업 단계의 첫 번째 milestone — 수동 예/아니오. 다른 로직에 영향 없음.
-- =============================================================================

begin;

alter table public.customer_statuses
  add column intake_confirmed boolean not null default false,
  add column health_check_completed boolean not null default false;

comment on column public.customer_statuses.intake_confirmed is
  '접수 "등록" 수동 결정 (예). intake_abandoned 와 mutually exclusive.';

comment on column public.customer_statuses.health_check_completed is
  '취업 단계 "건강검진 완료" 수동 milestone (예/아니오).';

-- backfill: 이미 진행 중인 고객들에게 intake_confirmed=true 부여
--   (포기/유학상담 아님 + 기초정보 핵심 만족)
update public.customer_statuses cs
   set intake_confirmed = true
  from public.customers c
 where cs.customer_id = c.id
   and cs.intake_abandoned = false
   and cs.study_abroad_consultation = false
   and (
     (c.name_kr is not null and trim(c.name_kr) <> '' and c.phone is not null and trim(c.phone) <> '')
     or
     (c.name_vi is not null and trim(c.name_vi) <> '' and c.phone is not null and trim(c.phone) <> '')
   );

commit;
