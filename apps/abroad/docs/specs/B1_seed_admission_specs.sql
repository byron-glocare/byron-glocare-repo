-- =====================================================================
-- B1 시드 — study_admission_specs 2건 (검증용)
--
-- 목적: 학생 지원 의향(study_applications) 등록 UI 검증에 필요한
--       approved 모집요강 데이터. PoC step1_raw 의 7건 중 universities
--       테이블에 존재하는 2건 (동남보건·서정) 만 시드.
--
-- JSONB 필드 정책:
--   - departments / schedule.semester_start : 채움 (지원 등록 UI 가 사용)
--   - required_documents / eligibility / tuition / scholarships / metadata : 빈값
--     (정식 풍부한 데이터는 B2 의 AI 자동 추출 워크플로에서 입력)
--
-- 베트남 순수외국인 필터 적용 — 다른 국적/카테고리 정보 생략.
-- =====================================================================

-- 1. 동남보건대학교 — 글로벌 헬스케어과 (2026-Spring, 외국인 전담학과 정원외)
INSERT INTO study_admission_specs (
  university_id,
  term,
  admission_category,
  program_type,
  departments,
  required_documents,
  eligibility,
  schedule,
  tuition,
  scholarships,
  metadata,
  source_file_url,
  status,
  approved_by,
  approved_at
)
VALUES (
  1,
  '2026-Spring',
  '외국인 전담학과 (정원외)',
  'associate_2yr',
  '[
    {"faculty": "보건", "name": "글로벌 헬스케어과", "track": "요양보호", "years": 2, "capacity": "unlimited", "korean_min_topik": 2},
    {"faculty": "보건", "name": "글로벌 헬스케어과", "track": "바이오제약", "years": 2, "capacity": "unlimited", "korean_min_topik": 2},
    {"faculty": "보건", "name": "글로벌 헬스케어과", "track": "뷰티케어", "years": 2, "capacity": "unlimited", "korean_min_topik": 2}
  ]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '{"semester_start": "2026-03-01"}'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  'reports/admission_poc/step1_raw/dongnambhc_global_healthcare_2026_spring.json',
  'approved',
  (SELECT id FROM auth.users WHERE email = 'byron@glocare.co.kr'),
  NOW()
);

-- 2. 서정대학교 — 글로벌요양복지과 순수외국인 입학전형 (2026-Spring)
INSERT INTO study_admission_specs (
  university_id,
  term,
  admission_category,
  program_type,
  departments,
  required_documents,
  eligibility,
  schedule,
  tuition,
  scholarships,
  metadata,
  source_file_url,
  status,
  approved_by,
  approved_at
)
VALUES (
  4,
  '2026-Spring',
  '순수외국인 입학전형 — 글로벌요양복지과',
  'associate_2yr',
  '[
    {"faculty": "인문사회", "name": "글로벌요양복지과", "years": 2, "capacity": 40, "korean_min_topik": 2}
  ]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '{"semester_start": "2026-03-03"}'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  'reports/admission_poc/step1_raw/seojeong_global_care_2026_spring.json',
  'approved',
  (SELECT id FROM auth.users WHERE email = 'byron@glocare.co.kr'),
  NOW()
);

-- 확인 query
SELECT id, university_id, term, admission_category, program_type, status,
       jsonb_array_length(departments) AS dept_count
FROM study_admission_specs
ORDER BY created_at DESC;
