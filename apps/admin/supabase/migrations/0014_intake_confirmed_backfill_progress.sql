-- =============================================================================
-- 0014: 접수 "등록" backfill 보강 — 이후 단계 진행 흔적 기준
--
-- 0013 의 backfill 은 "기초정보 핵심 (이름+전화) 충족" 기준이라
-- 누락된 케이스가 있을 수 있음.
--
-- 새 기준: 교육 예약 / 교육 / 취업 / 근무 단계에서 진행된 흔적이 있으면
-- intake_confirmed=true 로 일괄 처리. (접수 포기 = intake_abandoned=true 인 고객은
-- 그대로 둠. 둘 다 해당 안되면 미선택 유지.)
--
-- 진행 흔적의 구체 정의:
--   - customers: training_center_id / training_class_id / care_home_id /
--     class_start_date / class_end_date / work_start_date / work_end_date /
--     interview_date / visa_change_date / termination_reason 중 하나라도 NOT NULL
--   - customer_statuses 후속 플래그 (training_center_finding 부터 interview_passed
--     까지) 중 하나라도 true
--   - reservation_payments / welcome_pack_payments / commission_payments /
--     event_payments / sms_messages 에 row 가 존재
-- =============================================================================

begin;

update public.customer_statuses cs
   set intake_confirmed = true
  from public.customers c
 where cs.customer_id = c.id
   and cs.intake_abandoned = false
   and cs.intake_confirmed = false
   and (
        -- customers 진행 흔적
        c.training_center_id is not null
     or c.training_class_id is not null
     or c.care_home_id is not null
     or c.class_start_date is not null
     or c.class_end_date is not null
     or c.work_start_date is not null
     or c.work_end_date is not null
     or c.interview_date is not null
     or c.visa_change_date is not null
     or c.termination_reason is not null
        -- customer_statuses 후속 플래그
     or cs.training_center_finding
     or cs.class_schedule_confirmation_needed
     or cs.training_reservation_abandoned
     or cs.class_intake_sms_sent
     or cs.certificate_acquired
     or cs.training_dropped
     or cs.welcome_pack_abandoned
     or cs.health_check_completed
     or cs.care_home_finding
     or cs.resume_sent
     or cs.interview_passed
        -- 결제 / SMS 흔적
     or exists (select 1 from public.reservation_payments rp where rp.customer_id = c.id)
     or exists (select 1 from public.welcome_pack_payments wpp where wpp.customer_id = c.id)
     or exists (select 1 from public.commission_payments cp where cp.customer_id = c.id)
     or exists (select 1 from public.event_payments ep where ep.customer_id = c.id)
     or exists (select 1 from public.sms_messages sms where sms.target_customer_id = c.id)
   );

commit;
