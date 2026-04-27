-- =============================================================================
-- 0008: 강의 접수 메시지 발송을 수기 플래그로
--
-- 기존: sms_messages 테이블의 new_student 발송 이력으로 자동 판정
-- 변경: customer_statuses.class_intake_sms_sent (boolean) 수기 플래그
--   - 기본은 사용자가 진행 단계 탭에서 직접 토글
--   - SMS 자동 발송 기능을 쓰면 발송 직후 팝업으로 "ON 으로 변경할까요?"
--
-- 기존 발송 이력이 있는 고객은 마이그레이션 시점에 true 로 backfill.
-- =============================================================================

begin;

alter table public.customer_statuses
  add column class_intake_sms_sent boolean not null default false;

comment on column public.customer_statuses.class_intake_sms_sent is
  '강의 접수 메시지 발송 완료 (수기 플래그). 자동 발송 기능 사용 시 사용자 확인 후 ON.';

-- 기존 SMS 발송 이력이 있는 고객은 자동 ON
update public.customer_statuses cs
   set class_intake_sms_sent = true
  from public.sms_messages sm
 where sm.target_customer_id = cs.customer_id
   and sm.message_type = 'new_student';

commit;
