-- =====================================================================
--  C2 — 모집(offering) 옵션세트 재설계 + 서류 분기 (§5-3)
--
--  배경 (운영자 결정):
--   · 언어/거주지는 offering 을 "쪼개는 고정 축"이 아니라, 글로케어가 정하는
--     **선택지(옵션 세트)** 이고 → 센터/학생이 그 안에서 1개를 고른다.
--   · 언어: 한국어/영어/기타 중 글로케어가 available 지정. (학과 단위로 결정)
--   · 거주지: 국내(한국 체류, 대개 D-4)/해외(한국 밖) — 글로케어가 "거주지 분기를
--     제공할지" 설정. 제공 시 학생이 선택. 거주지에 따라 제출서류가 달라짐.
--   · 언어·거주지는 서로 독립.
--
--  변경:
--   · offering: language_track / student_location_scope (단일 고정) 제거
--               → available_languages[] / location_options[] (옵션 세트)
--   · unique 를 (university_id, department_id, term) 로 단순화 (트랙/위치로 안 쪼갬)
--   · study_applications: selected_language / selected_location (학생 선택값)
--   · study_required_submissions: applies_to_languages[] / applies_to_locations[]
--               (빈 배열 = 전체 적용 / 값 있으면 해당 선택에만 적용 → 서류 분기)
--
--  ⚠ study_offerings 는 C1 에서 막 만든 빈 테이블 → 컬럼 교체로 파괴되는 데이터 없음.
--     나머지는 전부 컬럼 추가(additive).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. offering — 옵션 세트로 교체
-- ---------------------------------------------------------------------
ALTER TABLE study_offerings
  ADD COLUMN IF NOT EXISTS available_languages text[] NOT NULL DEFAULT '{korean}',
  ADD COLUMN IF NOT EXISTS location_options    text[] NOT NULL DEFAULT '{}';

-- 단일 고정 축 제거 (빈 테이블 — 데이터 손실 없음). unique 제약도 교체.
ALTER TABLE study_offerings DROP CONSTRAINT IF EXISTS offering_unique_combo;
ALTER TABLE study_offerings DROP COLUMN  IF EXISTS language_track;
ALTER TABLE study_offerings DROP COLUMN  IF EXISTS student_location_scope;

-- 한 대학/학과/학기 = offering 1개 (언어/거주지는 그 안의 옵션)
ALTER TABLE study_offerings
  ADD CONSTRAINT offering_unique_combo
    UNIQUE (university_id, department_id, term);

-- ---------------------------------------------------------------------
-- 2. 학생 지원 — 선택한 언어/거주지
-- ---------------------------------------------------------------------
ALTER TABLE study_applications
  ADD COLUMN IF NOT EXISTS selected_language text
    CHECK (selected_language IS NULL OR selected_language IN ('korean','english','other')),
  ADD COLUMN IF NOT EXISTS selected_location text
    CHECK (selected_location IS NULL OR selected_location IN ('domestic','overseas'));

-- ---------------------------------------------------------------------
-- 3. 직접제출 서류 — 언어/거주지 분기 태그
--    빈 배열 = 모두에게 적용. 값 있으면 그 선택에 해당하는 학생에게만.
-- ---------------------------------------------------------------------
ALTER TABLE study_required_submissions
  ADD COLUMN IF NOT EXISTS applies_to_languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applies_to_locations text[] NOT NULL DEFAULT '{}';
