-- =============================================================================
-- Phase 10: 더미 데이터 투입
-- 개발지시서 §9 Phase 10 체크리스트 전 단계를 1~2건씩 커버
-- =============================================================================
-- 적용 방법:
--   Supabase Dashboard > SQL Editor > New query > 이 파일 전체 붙여넣기 > Run
--
-- 모든 더미 데이터는 식별자(code)가 'DUM' 접두사.
-- 되돌리려면 0003_dummy_data_rollback.sql 실행.
-- =============================================================================

do $$
declare
  -- 교육원 5개
  tc_daegu      uuid;
  tc_seoul      uuid;
  tc_gyeonggi   uuid;
  tc_chungnam   uuid;
  tc_busan      uuid;

  -- 강의 (주요)
  cls_daegu_04_day    uuid;
  cls_seoul_03_day    uuid;
  cls_seoul_05_night  uuid;
  cls_gyeonggi_04_day uuid;
  cls_chungnam_03_day uuid;
  cls_busan_04_night  uuid;

  -- 요양원 3개
  ch_seoul    uuid;
  ch_gyeonggi uuid;
  ch_busan    uuid;

  -- 고객 17명 (각 시나리오별)
  c01 uuid; c02 uuid; c03 uuid; c04 uuid; c05 uuid;
  c06 uuid; c07 uuid; c08 uuid; c09 uuid; c10 uuid;
  c11 uuid; c12 uuid; c13 uuid; c14 uuid; c15 uuid;
  c16 uuid; c17 uuid;

begin

-- =============================================================================
-- 1. 교육원 5개
-- =============================================================================

insert into training_centers (code, name, region, address, director_name, phone, email,
  bank_name, bank_account, tuition_fee_2025, tuition_fee_2026, class_hours, naeil_card_eligible, contract_status, notes)
values ('DUMCD001', '대구 미래 요양보호사교육원', '대구',
  '대구 수성구 범어동 123', '김영수', '053-111-2222', 'daegu@example.com',
  '국민은행', '111-22-333333', 1200000, 1300000, '9:30~16:50', true, '계약 완료', '주간 전용 교육원')
returning id into tc_daegu;

insert into training_centers (code, name, region, address, director_name, phone, email,
  bank_name, bank_account, tuition_fee_2025, tuition_fee_2026, class_hours, naeil_card_eligible, contract_status)
values ('DUMCD002', '서울 한빛 교육원', '서울',
  '서울 강남구 삼성동 777', '이정희', '02-333-4444', 'seoul@example.com',
  '신한은행', '222-33-444444', 1500000, 1600000, '주간 9:30~16:50 / 야간 18:30~22:30', true, '계약 완료')
returning id into tc_seoul;

insert into training_centers (code, name, region, address, director_name, phone,
  tuition_fee_2026, class_hours, naeil_card_eligible, contract_status)
values ('DUMCD003', '경기 한솔 교육원', '경기 수원',
  '경기 수원시 영통구 광교로 10', '박민수', '031-555-6666',
  1250000, '9:30~16:50', true, '계약 완료')
returning id into tc_gyeonggi;

insert into training_centers (code, name, region, address, director_name, phone,
  tuition_fee_2026, class_hours, naeil_card_eligible, contract_status)
values ('DUMCD004', '충남 희망 교육원', '충남 천안',
  '충남 천안시 서북구 성환읍', '최은진', '041-777-8888',
  1200000, '9:30~16:50', true, '계약 완료')
returning id into tc_chungnam;

insert into training_centers (code, name, region, address, director_name, phone,
  tuition_fee_2026, class_hours, naeil_card_eligible, contract_status, notes)
values ('DUMCD005', '부산 파라다이스 교육원', '부산 해운대',
  '부산 해운대구 좌동 234', '정수현', '051-999-0000',
  1400000, '야간 18:30~22:30', false, '협의중', '야간 전용')
returning id into tc_busan;

-- =============================================================================
-- 2. 월별 개강 정보
-- =============================================================================

insert into training_classes (training_center_id, year, month, class_type, start_date, end_date, notes)
values (tc_daegu, 2026, 4, 'weekday', '2026-04-01', '2026-06-15', '4월 정규 개강')
returning id into cls_daegu_04_day;

insert into training_classes (training_center_id, year, month, class_type, start_date, end_date)
values (tc_seoul, 2026, 3, 'weekday', '2026-03-15', '2026-05-30')
returning id into cls_seoul_03_day;

insert into training_classes (training_center_id, year, month, class_type, start_date, end_date)
values (tc_seoul, 2026, 5, 'night', '2026-05-01', '2026-08-10')
returning id into cls_seoul_05_night;

insert into training_classes (training_center_id, year, month, class_type, start_date, end_date)
values (tc_gyeonggi, 2026, 4, 'weekday', '2026-04-15', '2026-07-01')
returning id into cls_gyeonggi_04_day;

insert into training_classes (training_center_id, year, month, class_type, start_date, end_date)
values (tc_chungnam, 2026, 3, 'weekday', '2026-03-01', '2026-05-15')
returning id into cls_chungnam_03_day;

insert into training_classes (training_center_id, year, month, class_type, start_date, end_date)
values (tc_busan, 2026, 4, 'night', '2026-04-20', '2026-07-30')
returning id into cls_busan_04_night;

-- =============================================================================
-- 3. 요양원 3개
-- =============================================================================

insert into care_homes (code, name, region, address, director_name, phone, contact_person, contact_phone, bed_capacity, partnership_notes)
values ('DUMCH001', '서울 행복요양원', '서울', '서울 은평구 응암동', '김행복', '02-111-2222',
  '이담당', '010-1111-1111', '45/60', '교육생 월 2명 수용 가능')
returning id into ch_seoul;

insert into care_homes (code, name, region, address, director_name, phone, contact_person, contact_phone, bed_capacity)
values ('DUMCH002', '경기 푸른요양원', '경기 용인', '경기 용인시 수지구', '박푸른', '031-222-3333',
  '최담당', '010-2222-2222', '80/100')
returning id into ch_gyeonggi;

insert into care_homes (code, name, region, address, director_name, phone, contact_person, contact_phone, bed_capacity, partnership_notes)
values ('DUMCH003', '부산 바다요양원', '부산', '부산 해운대구', '정바다', '051-333-4444',
  '윤담당', '010-3333-3333', '30/40', '해운대 해변 근처')
returning id into ch_busan;

-- =============================================================================
-- 4. 고객 17명 (단계별 시나리오)
-- =============================================================================

-- ---- c01: 접수중 (기초정보 핵심 — 이름+전화만) ----
insert into customers (code, name_vi, name_kr, phone, created_at)
values ('DUM2604001', 'Phạm Thị Mai', '팜 티 마이', '010-0000-0001', now() - interval '1 hour')
returning id into c01;

-- ---- c02: 접수중 (기초정보 완벽) ----
insert into customers (code, name_vi, name_kr, phone, address, gender, birth_year, visa_type, topik_level, created_at)
values ('DUM2604002', 'Nguyễn Văn A', '응우옌 반 에이', '010-0000-0002',
  '서울 강남구 역삼동', '남', 1995, 'D-10', 'TOPIK 3',
  now() - interval '1 day')
returning id into c02;

-- ---- c03: 접수포기 ----
insert into customers (code, name_vi, phone, created_at)
values ('DUM2604003', 'Trần Thị B', '010-0000-0003', now() - interval '3 days')
returning id into c03;
update customer_statuses set intake_abandoned = true where customer_id = c03;

-- ---- c04: 유학상담으로 전환 ----
insert into customers (code, name_vi, name_kr, phone, created_at)
values ('DUM2604004', 'Lê Văn C', '레 반 씨', '010-0000-0004', now() - interval '5 days')
returning id into c04;
update customer_statuses set study_abroad_consultation = true where customer_id = c04;

-- ---- c05: 교육원 발굴 중 ----
insert into customers (code, name_vi, name_kr, phone, address, gender, birth_year, visa_type, desired_region, desired_time, created_at)
values ('DUM2604005', 'Phạm Văn D', '팜 반 디', '010-0000-0005',
  '인천 연수구', '남', 1998, 'D-10', '경기', '주간',
  now() - interval '7 days')
returning id into c05;
update customer_statuses set training_center_finding = true where customer_id = c05;

-- ---- c06: 교육 예약 완료 (교육원+강의+예약금 입금) ----
insert into customers (code, name_vi, name_kr, phone, address, gender, birth_year, visa_type,
  training_center_id, training_class_id, class_start_date, class_end_date, product_type, created_at)
values ('DUM2604006', 'Nguyễn Thị E', '응우옌 티 이', '010-0000-0006',
  '서울 강남구', '여', 1993, 'F-2-R',
  tc_seoul, cls_seoul_05_night, '2026-05-01', '2026-08-10', '교육',
  now() - interval '10 days')
returning id into c06;

insert into reservation_payments (customer_id, amount, payment_date)
values (c06, 35000, current_date - 5);

-- ---- c07: 교육 중 (강의 시작 지남, 종료 전) ----
insert into customers (code, name_vi, name_kr, phone, address, gender, birth_year, visa_type,
  training_center_id, training_class_id, class_start_date, class_end_date, product_type, created_at)
values ('DUM2604007', 'Trần Văn F', '쩐 반 에프', '010-0000-0007',
  '경기 수원시', '남', 1994, 'D-10',
  tc_gyeonggi, cls_gyeonggi_04_day, '2026-04-15', '2026-07-01', '교육+웰컴팩',
  now() - interval '20 days')
returning id into c07;

insert into reservation_payments (customer_id, amount, payment_date)
values (c07, 100000, current_date - 15);

insert into sms_messages (message_type, target_customer_id, target_center_id, content)
values ('new_student', c07, tc_gyeonggi, '[더미] 신규 교육생 알림 발송 이력');

-- ---- c08: 교육 완료 + 자격증 취득 ----
insert into customers (code, name_vi, name_kr, phone, address, gender, birth_year, visa_type,
  training_center_id, training_class_id, class_start_date, class_end_date, product_type, created_at)
values ('DUM2604008', 'Lê Thị G', '레 티 지', '010-0000-0008',
  '충남 천안시', '여', 1992, 'F-2-R',
  tc_chungnam, cls_chungnam_03_day, '2026-03-01', '2026-04-15', '교육+웰컴팩',
  now() - interval '60 days')
returning id into c08;

update customer_statuses set certificate_acquired = true where customer_id = c08;

insert into reservation_payments (customer_id, amount, payment_date)
values (c08, 100000, current_date - 50);

insert into commission_payments (customer_id, training_center_id, total_amount, deduction_amount, received_amount, status)
values (c08, tc_chungnam, 300000, 35000, 265000, 'pending');

-- ---- c09: 교육 드랍 ----
insert into customers (code, name_vi, name_kr, phone, birth_year, visa_type,
  training_center_id, training_class_id, class_start_date, class_end_date, product_type, created_at)
values ('DUM2604009', 'Phan Văn H', '판 반 에이치', '010-0000-0009',
  1990, 'D-10',
  tc_daegu, cls_daegu_04_day, '2026-04-01', '2026-06-15', '교육',
  now() - interval '30 days')
returning id into c09;

update customer_statuses set training_dropped = true where customer_id = c09;

insert into reservation_payments (customer_id, amount, payment_date, refund_reason)
values (c09, 35000, current_date - 25, '중도탈락_매출인식');

-- ---- c10: 요양원 발굴 중 (자격증 취득 후) ----
insert into customers (code, name_vi, name_kr, phone, address, gender, birth_year, visa_type,
  training_center_id, training_class_id, class_start_date, class_end_date, product_type, created_at)
values ('DUM2604010', 'Hoàng Thị I', '호앙 티 아이', '010-0000-0010',
  '서울 은평구', '여', 1996, 'F-2-R',
  tc_seoul, cls_seoul_03_day, '2026-03-15', '2026-04-30', '교육+웰컴팩',
  now() - interval '40 days')
returning id into c10;

update customer_statuses set certificate_acquired = true, care_home_finding = true where customer_id = c10;

insert into welcome_pack_payments (customer_id, total_price, discount_amount, reservation_amount, reservation_date)
values (c10, 1500000, 300000, 100000, current_date - 35);

-- ---- c11: 요양원 매칭, 면접 전 ----
insert into customers (code, name_vi, name_kr, phone, birth_year, visa_type,
  training_center_id, training_class_id, care_home_id,
  class_start_date, class_end_date, interview_date, product_type, created_at)
values ('DUM2604011', 'Võ Thị J', '보 티 제이', '010-0000-0011',
  1989, 'F-2-R',
  tc_seoul, cls_seoul_03_day, ch_seoul,
  '2026-03-15', '2026-04-30', '2026-05-05', '교육+웰컴팩',
  now() - interval '45 days')
returning id into c11;

update customer_statuses set certificate_acquired = true where customer_id = c11;

insert into welcome_pack_payments (customer_id, total_price, discount_amount, reservation_amount, reservation_date,
  interim_amount, interim_date)
values (c11, 1500000, 300000, 100000, current_date - 40, 250000, current_date - 10);

-- ---- c12: 면접 합격, 근무 대기 ----
insert into customers (code, name_vi, name_kr, phone, birth_year, visa_type,
  training_center_id, training_class_id, care_home_id,
  class_start_date, class_end_date, interview_date, product_type, created_at)
values ('DUM2604012', 'Bùi Văn K', '부이 반 케이', '010-0000-0012',
  1991, 'F-2-R',
  tc_gyeonggi, cls_gyeonggi_04_day, ch_gyeonggi,
  '2026-04-15', '2026-07-01', '2026-04-15', '교육+웰컴팩',
  now() - interval '50 days')
returning id into c12;

update customer_statuses set certificate_acquired = true, interview_passed = true where customer_id = c12;

insert into welcome_pack_payments (customer_id, total_price, discount_amount, reservation_amount, reservation_date,
  interim_amount, interim_date, sales_reported, sales_reported_date)
values (c12, 1500000, 300000, 100000, current_date - 45, 300000, current_date - 15, true, current_date - 5);

-- ---- c13: 근무 중 (work_start 과거, work_end null) ----
insert into customers (code, name_vi, name_kr, phone, birth_year, visa_type,
  training_center_id, care_home_id, work_start_date, product_type, created_at)
values ('DUM2604013', 'Đặng Thị L', '당 티 엘', '010-0000-0013',
  1988, 'F-2-R',
  tc_busan, ch_busan, current_date - 45, '웰컴팩',
  now() - interval '80 days')
returning id into c13;

update customer_statuses set certificate_acquired = true, interview_passed = true where customer_id = c13;

-- ---- c14: 비자 변경 완료 ----
insert into customers (code, name_vi, name_kr, phone, birth_year, visa_type,
  training_center_id, care_home_id, work_start_date, visa_change_date, product_type, created_at)
values ('DUM2604014', 'Ngô Văn M', '응오 반 엠', '010-0000-0014',
  1987, 'E-7-2',
  tc_chungnam, ch_seoul, current_date - 120, current_date - 60, '교육+웰컴팩',
  now() - interval '180 days')
returning id into c14;

update customer_statuses set certificate_acquired = true, interview_passed = true where customer_id = c14;

-- ---- c15: 대기 중 (재연락일 도래) ----
insert into customers (code, name_vi, name_kr, phone, birth_year, visa_type,
  is_waiting, recontact_date, waiting_memo, created_at)
values ('DUM2604015', 'Trịnh Văn N', '찐 반 엔', '010-0000-0015',
  1997, 'D-10',
  true, current_date - 2, '다음 주 초에 교육원 발굴 결과 재확인 예정',
  now() - interval '15 days')
returning id into c15;

-- ---- c16: 종료 — 귀국 ----
insert into customers (code, name_vi, name_kr, phone, birth_year,
  termination_reason, created_at)
values ('DUM2604016', 'Vũ Thị O', '부 티 오', '010-0000-0016',
  1993,
  '귀국', now() - interval '100 days')
returning id into c16;

-- ---- c17: 종료 — 직종변경 ----
insert into customers (code, name_vi, name_kr, phone, birth_year,
  termination_reason, created_at)
values ('DUM2604017', 'Chu Văn P', '추 반 피', '010-0000-0017',
  1995,
  '요양보호사 직종변경', now() - interval '200 days')
returning id into c17;

-- =============================================================================
-- 5. 상담 일지 샘플
-- =============================================================================

insert into customer_consultations (customer_id, consultation_type, content_vi, content_kr) values
  (c06, 'training_center',
   'Em muốn đăng ký lớp ban đêm vì ban ngày đi làm. Em cần học phí trả góp được không?',
   '저는 낮에 일을 해서 야간반을 신청하고 싶습니다. 수강료는 분할 납부 가능한지 궁금합니다.'),
  (c07, 'training_center',
   'Em đã đóng tiền đặt cọc, bao giờ có thể nhận giáo trình?',
   '예약금 납부 완료했습니다. 교재는 언제 받을 수 있나요?'),
  (c11, 'care_home',
   'Em có thể làm việc ca đêm không? Em thích làm ca đêm vì lương cao hơn.',
   '야간 근무 가능한지 문의드립니다. 급여가 높아 야간 근무 선호합니다.'),
  (c12, 'care_home',
   'Em đã đậu phỏng vấn, khi nào có thể bắt đầu làm việc?',
   '면접 합격했습니다. 언제부터 근무 시작할 수 있나요?');

-- =============================================================================
-- 6. 이벤트 결제 (친구 소개 — c01 ↔ c02)
-- =============================================================================

insert into event_payments (customer_id, event_type, amount, gift_type, friend_customer_id, gift_given, gift_given_date)
values
  (c01, '친구 소개', 50000, '쿠팡상품권', c02, true, current_date - 1),
  (c02, '친구 소개', 50000, '쿠팡상품권', c01, true, current_date - 1);

-- 일반 이벤트 — c05 에 교통비 지원
insert into event_payments (customer_id, event_type, amount, gift_type, gift_given)
values (c05, '교통비 지원', 30000, '현금', false);

-- =============================================================================
-- 완료
-- =============================================================================

raise notice '더미 데이터 투입 완료 — 교육원 5 / 요양원 3 / 강의 6 / 고객 17 / 결제 각종';

end $$;
