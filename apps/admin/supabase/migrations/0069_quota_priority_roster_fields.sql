-- =============================================================================
-- 0069: 모집 인원(글로케어/전체) · 지원 지망 순위 · 학생 등록 항목 확대 (지원자 명단 엑셀 기준)
--
-- 운영자 결정(2026-09-21):
--   1) 모집 인원: 지금 칸(intake_quota) = 글로케어 인원. 전체(학교 정원) 칸 추가.
--   5) 지원 지망: 같은 학기 안에서 1~3지망. 관리자 참고용. 결제는 지원마다 따로(그대로).
--   2·3) 센터의 학생 등록·엑셀 일괄 등록에 "Abroad Student List_Glocare.xlsx" 항목 전부.
--        값은 작성서류가 쓰는 데이터 항목(study_student_data_values)에 저장해 두 번 입력하지 않는다.
--        없는 항목만 새로 만든다. 출신지역 = 기존 "베트남 거주 도시", 월수입은 부·모 각각(합계는 화면 계산).
-- 여러 번 돌려도 같다.
-- =============================================================================

-- 1. 전체(학교) 모집 인원
alter table public.study_offerings add column if not exists total_quota integer check (total_quota is null or total_quota >= 0);
comment on column public.study_offerings.intake_quota is '글로케어 모집 인원 (오픈 조건)';
comment on column public.study_offerings.total_quota is '학교 전체 모집 인원 (정원)';

-- 5. 지망 순위
alter table public.study_applications add column if not exists priority smallint check (priority is null or priority between 1 and 3);
comment on column public.study_applications.priority is '같은 학생·같은 학기 안의 지망 순위(1~3). 관리자 참고용';

-- 기존 지원 건: 학생·학기별 만든 순서대로 1~3 (취소 건 제외, 이미 순위가 있으면 건너뜀)
update public.study_applications a
   set priority = r.rn
  from (
    select id, row_number() over (partition by student_id, coalesce(term, '') order by created_at) as rn
      from public.study_applications
     where status <> 'cancelled'
  ) r
 where a.id = r.id and a.priority is null and r.rn <= 3;

-- 2·3. 새 데이터 항목 (없는 것만). 모두 작성서류용(document_fill) · 독립 항목
insert into public.study_student_data_types
  (key, label_ko, label_vi, category, input_type, options, sort_order, is_active, scope, link_type)
values
  ('desired_visa_type',      '희망 비자',                 'Loại visa muốn đăng ký',             'identity',  'select',
     '[{"value":"D-4","label_ko":"D-4 (어학연수)","label_vi":"D-4 (học tiếng)"},{"value":"D-2","label_ko":"D-2 (학위과정)","label_vi":"D-2 (hệ chính quy)"},{"value":"other","label_ko":"기타","label_vi":"Khác"}]'::jsonb,
     95, true, 'document_fill', 'independent'),
  ('desired_term',           '지원 학기',                 'Kỳ đăng ký',                         'education', 'text',    null, 96, true, 'document_fill', 'independent'),
  ('korea_visa_history',     '한국 비자 신청(거절) 이력', 'Đã xin / trượt visa Hàn chưa',       'identity',  'text',    null, 102, true, 'document_fill', 'independent'),
  ('national_id_no',         '신분증 번호 (본인)',        'Số CCCD (học sinh)',                 'identity',  'text',    null, 26, true, 'document_fill', 'independent'),
  ('final_education_level',  '최종학력',                  'Học lực cao nhất',                   'education', 'select',
     '[{"value":"high_school","label_ko":"고등학교 졸업","label_vi":"Tốt nghiệp THPT"},{"value":"college","label_ko":"전문대 졸업","label_vi":"Tốt nghiệp cao đẳng"},{"value":"university","label_ko":"대학 졸업","label_vi":"Tốt nghiệp đại học"}]'::jsonb,
     49, true, 'document_fill', 'independent'),
  ('bachelor_admission_date','대학 입학일 (있을 시)',     'Ngày nhập học ĐH/CĐ',                'education', 'date',    null, 57, true, 'document_fill', 'independent'),
  ('final_education_score',  '최종학력 점수 (대학·전문대)','Điểm tốt nghiệp CĐ/ĐH',             'education', 'text',    null, 58, true, 'document_fill', 'independent'),
  ('hs_grade_1',             '고교 1학년 성적',           'Điểm lớp 10',                        'education', 'number',  null, 54, true, 'document_fill', 'independent'),
  ('hs_grade_2',             '고교 2학년 성적',           'Điểm lớp 11',                        'education', 'number',  null, 55, true, 'document_fill', 'independent'),
  ('hs_grade_3',             '고교 3학년 성적',           'Điểm lớp 12',                        'education', 'number',  null, 56, true, 'document_fill', 'independent'),
  ('hs_absence_1',           '고교 1학년 결석일수',       'Số buổi nghỉ lớp 10',                'education', 'number',  null, 59, true, 'document_fill', 'independent'),
  ('hs_absence_2',           '고교 2학년 결석일수',       'Số buổi nghỉ lớp 11',                'education', 'number',  null, 60, true, 'document_fill', 'independent'),
  ('hs_absence_3',           '고교 3학년 결석일수',       'Số buổi nghỉ lớp 12',                'education', 'number',  null, 61, true, 'document_fill', 'independent'),
  ('home_province',          '현주소 성·시',              'Địa chỉ hiện tại - Tỉnh/Thành phố',  'contact',   'text',    null, 160, true, 'document_fill', 'independent'),
  ('home_district',          '현주소 구·현',              'Địa chỉ hiện tại - Quận/Huyện',      'contact',   'text',    null, 161, true, 'document_fill', 'independent'),
  ('home_ward',              '현주소 동·마을',            'Địa chỉ hiện tại - Phường/Xã',       'contact',   'text',    null, 162, true, 'document_fill', 'independent'),
  ('father_national_id',     '아버지 신분증 번호',        'Số CCCD của bố',                     'family',    'text',    null, 204, true, 'document_fill', 'independent'),
  ('mother_national_id',     '어머니 신분증 번호',        'Số CCCD của mẹ',                     'family',    'text',    null, 214, true, 'document_fill', 'independent'),
  ('father_monthly_income',  '아버지 월수입',             'Thu nhập hàng tháng của bố',         'family',    'number',  null, 205, true, 'document_fill', 'independent'),
  ('mother_monthly_income',  '어머니 월수입',             'Thu nhập hàng tháng của mẹ',         'family',    'number',  null, 215, true, 'document_fill', 'independent'),
  ('has_family_in_korea',    '한국 내 가족 여부',         'Có người thân ở Hàn Quốc không',     'family',    'text',    null, 230, true, 'document_fill', 'independent'),
  ('has_bank_balance_cert',  '은행 잔고증명서 유무',      'Có sổ tiết kiệm ngân hàng không',    'financial', 'text',    null, 300, true, 'document_fill', 'independent')
on conflict (key) do nothing;

-- 확인
select
  exists (select 1 from information_schema.columns where table_name = 'study_offerings' and column_name = 'total_quota') as has_total_quota,
  exists (select 1 from information_schema.columns where table_name = 'study_applications' and column_name = 'priority') as has_priority,
  (select count(*) from public.study_applications where priority is not null) as apps_with_priority,
  (select count(*) from public.study_student_data_types where key in (
     'desired_visa_type','desired_term','korea_visa_history','national_id_no','final_education_level','bachelor_admission_date',
     'final_education_score','hs_grade_1','hs_grade_2','hs_grade_3','hs_absence_1','hs_absence_2','hs_absence_3',
     'home_province','home_district','home_ward','father_national_id','mother_national_id','father_monthly_income',
     'mother_monthly_income','has_family_in_korea','has_bank_balance_cert')) as new_data_types;  -- 22
