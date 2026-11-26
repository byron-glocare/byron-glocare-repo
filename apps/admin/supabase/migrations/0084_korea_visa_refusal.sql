-- =============================================================================
-- 0084: 한국 비자 불허 이력 — 있음/없음 + 불허 사유 + 불허 서류 사진 (KAN-38)
--
-- 과거 한국 비자 불허 사유에 따라 지원해도 무조건 떨어질 수 있어, 등록 때 정확히 받는다.
--   1) korea_visa_history  : 자유 입력 → 있음(yes)/없음(no) 선택
--   2) korea_visa_refusal_reason : 불허 사유 (긴 글, 직접 입력) — 신규
--   3) korea_visa_refusal_doc    : 불허 사유가 적힌 서류 사진 (파일) — 신규
--   기존 값 1건 "Rồi"(이미 있음) → "yes" 로 바꾼다. 그 밖의 값은 건드리지 않는다.
--
-- 안전: 칸 추가는 없는 것만. 여러 번 돌려도 같다. 데이터 삭제 없음.
-- ⚠ 이 SQL 을 먼저 실행한 뒤 배포한다 — 새 코드가 새 항목을 쓴다.
-- =============================================================================

-- 1. 신청 이력 = 있음/없음 선택
update public.study_student_data_types
   set label_ko   = '한국 비자 신청 이력',
       label_vi   = 'Đã từng xin visa Hàn Quốc chưa',
       input_type = 'select',
       options    = '[{"value":"yes","label_ko":"있음","label_vi":"Có"},{"value":"no","label_ko":"없음","label_vi":"Không"}]'::jsonb,
       updated_at = now()
 where key = 'korea_visa_history';

-- 기존 자유 입력값 → yes/no (알아볼 수 있는 것만)
update public.study_student_data_values
   set value = '"yes"'::jsonb, updated_at = now()
 where data_type_key = 'korea_visa_history'
   and lower(trim(both '"' from value::text)) in ('rồi', 'roi', 'có', 'co', 'yes', '있음', '예', 'đã');
update public.study_student_data_values
   set value = '"no"'::jsonb, updated_at = now()
 where data_type_key = 'korea_visa_history'
   and lower(trim(both '"' from value::text)) in ('chưa', 'chua', 'không', 'khong', 'no', '없음', '아니오');

-- 2·3. 불허 사유 · 불허 서류 (없는 것만)
insert into public.study_student_data_types
  (key, label_ko, label_vi, category, input_type, options, sort_order, is_active, scope, link_type, hint_ko, hint_vi)
values
  ('korea_visa_refusal_reason', '한국 비자 불허 사유', 'Lý do bị từ chối visa Hàn Quốc', 'identity', 'long_text', null, 103, true, 'document_fill', 'independent',
     '신청 이력이 있음일 때만. 불허 통지서에 적힌 사유를 그대로', 'Chỉ khi đã từng xin visa. Ghi đúng lý do trên giấy thông báo từ chối'),
  ('korea_visa_refusal_doc',    '한국 비자 불허 서류 사진', 'Ảnh giấy từ chối visa Hàn Quốc', 'identity', 'file', null, 104, true, 'document_fill', 'independent',
     '불허 사유가 적힌 서류 사진', 'Ảnh giấy ghi lý do bị từ chối')
on conflict (key) do nothing;

-- 확인 — 3행, korea_visa_history 는 select
select key, label_ko, input_type, sort_order
  from public.study_student_data_types
 where key in ('korea_visa_history', 'korea_visa_refusal_reason', 'korea_visa_refusal_doc')
 order by sort_order;
