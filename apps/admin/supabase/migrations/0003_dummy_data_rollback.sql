-- =============================================================================
-- Phase 10: 더미 데이터 롤백
-- 0003_dummy_data.sql 로 투입된 더미 레코드만 삭제.
-- 실데이터는 건드리지 않습니다 (코드 접두사 'DUM' 기준).
-- =============================================================================

-- 자식 레코드는 ON DELETE CASCADE 로 자동 정리됨
-- (customer_statuses, customer_consultations, reservation/commission/event/welcome payments)

-- SMS 이력 — target_customer_id 또는 target_center_id 기준
delete from sms_messages
where target_customer_id in (select id from customers where code like 'DUM%')
   or target_center_id in (select id from training_centers where code like 'DUMCD%');

-- 고객
delete from customers where code like 'DUM%';

-- 강의
delete from training_classes
where training_center_id in (select id from training_centers where code like 'DUMCD%');

-- 교육원 / 요양원
delete from training_centers where code like 'DUMCD%';
delete from care_homes where code like 'DUMCH%';
