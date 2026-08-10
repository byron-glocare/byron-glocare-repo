-- 0049: 지원 정보(년도·학기·월) 표준데이터 추가
--
-- 배경: 지원 학과·년도·학기·월은 학생이 "지원 대학을 고르는 것"으로 이미 입력한 값인데,
--       표준데이터에는 지원학과(part_class_name)만 있고 년도/학기/월이 없어 서류에 못 채웠다.
--       원본은 모집요강에 있다 — term("2026-Fall") + schedule.semester_start("2026-09-01").
--
-- 값 자체는 애플리케이션이 지원 레코드에서 자동으로 채워 넣는다(빈 값일 때만).
-- 유학센터·학생이 정보입력에서 수정할 수 있다.
--
-- 멱등: 이미 있으면 라벨·힌트만 갱신하고 학생 입력값(study_student_data_values)은 건드리지 않는다.
--       key 유니크 제약 유무에 의존하지 않도록 insert…where not exists / update 두 단계로 쓴다.

-- ── 1. 신규 3종 삽입 (없을 때만) ─────────────────────────────────────────────
insert into study_student_data_types
  (key, label_ko, label_vi, category, input_type, options, hint_ko, hint_vi,
   is_essay_basis, is_default_required, sort_order, is_active, scope, link_type)
select v.key, v.label_ko, v.label_vi, v.category, v.input_type, v.options,
       v.hint_ko, v.hint_vi, false, false, v.sort_order, true, 'document_fill', 'independent'
from (values
  ('apply_year', '지원 년도', 'Năm nhập học', 'education', 'text',
   null::jsonb,
   '지원한 모집요강의 입학 년도. 지원 정보에서 자동으로 채워집니다.',
   'Năm nhập học của đợt tuyển sinh đã đăng ký. Được điền tự động.', 1),

  ('apply_semester', '지원 학기', 'Học kỳ nhập học', 'education', 'select',
   '[{"value":"1학기","label_ko":"1학기","label_vi":"Học kỳ 1"},
     {"value":"2학기","label_ko":"2학기","label_vi":"Học kỳ 2"}]'::jsonb,
   '지원한 모집요강의 학기. 지원 정보에서 자동으로 채워집니다.',
   'Học kỳ của đợt tuyển sinh đã đăng ký. Được điền tự động.', 2),

  ('apply_month', '지원 월', 'Tháng nhập học', 'education', 'text',
   null::jsonb,
   '입학(개강) 월. 모집요강의 개강일에서 자동으로 채워집니다.',
   'Tháng nhập học. Được điền tự động từ ngày khai giảng.', 3)
) as v(key, label_ko, label_vi, category, input_type, options, hint_ko, hint_vi, sort_order)
where not exists (
  select 1 from study_student_data_types t where t.key = v.key
);

-- ── 2. 이미 있던 경우 라벨·힌트·정렬 갱신 (재실행 안전) ──────────────────────
update study_student_data_types t set
  label_ko   = v.label_ko,
  label_vi   = v.label_vi,
  category   = 'education',
  input_type = v.input_type,
  options    = v.options,
  hint_ko    = v.hint_ko,
  hint_vi    = v.hint_vi,
  sort_order = v.sort_order,
  is_active  = true,
  updated_at = now()
from (values
  ('apply_year', '지원 년도', 'Năm nhập học', 'text', null::jsonb,
   '지원한 모집요강의 입학 년도. 지원 정보에서 자동으로 채워집니다.',
   'Năm nhập học của đợt tuyển sinh đã đăng ký. Được điền tự động.', 1),
  ('apply_semester', '지원 학기', 'Học kỳ nhập học', 'select',
   '[{"value":"1학기","label_ko":"1학기","label_vi":"Học kỳ 1"},
     {"value":"2학기","label_ko":"2학기","label_vi":"Học kỳ 2"}]'::jsonb,
   '지원한 모집요강의 학기. 지원 정보에서 자동으로 채워집니다.',
   'Học kỳ của đợt tuyển sinh đã đăng ký. Được điền tự động.', 2),
  ('apply_month', '지원 월', 'Tháng nhập học', 'text', null::jsonb,
   '입학(개강) 월. 모집요강의 개강일에서 자동으로 채워집니다.',
   'Tháng nhập học. Được điền tự động từ ngày khai giảng.', 3)
) as v(key, label_ko, label_vi, input_type, options, hint_ko, hint_vi, sort_order)
where t.key = v.key;

-- ── 3. 지원학과는 이미 있으나 자동 채움 사실이 안 보인다 — 힌트만 보강 ────────
update study_student_data_types
   set hint_ko = coalesce(nullif(hint_ko, ''), '지원한 학과. 지원 정보에서 자동으로 채워집니다.'),
       hint_vi = coalesce(nullif(hint_vi, ''), 'Ngành đã đăng ký. Được điền tự động.'),
       updated_at = now()
 where key = 'part_class_name';

-- 확인용
-- select key, label_ko, category, input_type, sort_order, is_active
--   from study_student_data_types
--  where key in ('part_class_name','apply_year','apply_semester','apply_month')
--  order by sort_order;
