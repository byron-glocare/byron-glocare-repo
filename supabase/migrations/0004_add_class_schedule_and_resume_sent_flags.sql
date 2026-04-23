-- =============================================================================
-- 0004: customer_statuses 에 체크포인트 플래그 2개 추가
--   - class_schedule_confirmation_needed: 교육원에 강의 일정 확인 필요 여부.
--       교육원 매칭 ↔ 강의일정 확정 사이의 중간 상태를 표현.
--   - resume_sent: 이력서 발송 여부. 이전에는 sms_messages 의
--       message_type='resume_sent' 로 파생했으나, 실제 발송 기능이 아직
--       구현되지 않은 상태라 수동 토글로 전환.
-- =============================================================================

alter table public.customer_statuses
  add column if not exists class_schedule_confirmation_needed boolean not null default false;

alter table public.customer_statuses
  add column if not exists resume_sent boolean not null default false;

comment on column public.customer_statuses.class_schedule_confirmation_needed is
  '강의 일정 정보가 없어 교육원에 확인이 필요한 상태. 교육원 매칭 직후, 강의일정이 확정되기 전 단계.';
comment on column public.customer_statuses.resume_sent is
  '이력서를 요양원에 발송했는지 여부 (수동 플래그).';
