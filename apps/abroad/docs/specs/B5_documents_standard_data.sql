-- =====================================================================
--  B5 — 입학서류 재설계 + 표준데이터 모델 확장
--
--  설계 결정 (운영자 컨펌):
--   · 입학서류 3종은 "테이블 분리 + 통합 뷰" (성격/생명주기가 달라 물리 통합 안 함)
--       모집요강 = study_admission_specs            (기존, 유지)
--       양식      = study_admission_form_files       (기존, 유지)
--       직접제출  = study_required_submissions        (★ 신설 — 샘플이미지 + 발급요건/리드타임)
--   · 표준데이터: scope(대학정보/서류작성) + 별칭(alias) + 역할기반 파생필드(보호자 택1) + 서명타입
--
--  ⚠ 전부 additive (신규 테이블 / 컬럼 추가 / 뷰). 기존 테이블 RLS 재실행 없음.
--    universities·departments·specs·form_files 데이터 그대로.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 직접제출 서류 (study_required_submissions)
--    글로케어가 샘플 이미지를 올리고, 학생/센터가 참고해 발급·제출.
--    대학(+학과)별로 발급 세부요건이 다를 수 있어 대학 종속.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_required_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id   bigint NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id   bigint REFERENCES departments(id) ON DELETE SET NULL,  -- NULL = 대학 전체 공통
  name_ko         text NOT NULL,
  name_vi         text,

  -- 글로케어가 올리는 참고용 샘플 이미지 (비공개 버킷 path)
  sample_image_url text,

  -- 발급 요건 + 리드타임 (예: 번역공증 성적증명서)
  --   { issuer, validity_days, lead_time_days, needs_notarization, needs_translation, notes }
  issuance_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- 이 서류에 담겨 있어 AI로 뽑아낼 수 있는 표준데이터 키
  required_data_type_keys text[] NOT NULL DEFAULT '{}',

  -- AI 매칭용 별칭 (같은 서류 다른 이름)
  aliases         text[] NOT NULL DEFAULT '{}',

  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','archived')),
  source_spec_id  uuid REFERENCES study_admission_specs(id) ON DELETE SET NULL, -- 모집요강 제출목록에서 파생된 경우
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_req_sub_university
  ON study_required_submissions(university_id);
CREATE INDEX IF NOT EXISTS idx_req_sub_dept
  ON study_required_submissions(department_id);

ALTER TABLE study_required_submissions ENABLE ROW LEVEL SECURITY;

-- 글로케어 어드민: 전체 CRUD (form_files 패턴 미러)
CREATE POLICY req_sub_admin_all ON study_required_submissions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 인증된 사용자(유학센터 포함): 활성/승인 서류만 read
CREATE POLICY req_sub_authed_read ON study_required_submissions
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true AND status = 'approved');


-- ---------------------------------------------------------------------
-- 2. 표준데이터 카탈로그 확장 (study_student_data_types)
--    scope 2분류 + 별칭 + 역할기반 파생 + 서명 입력타입
-- ---------------------------------------------------------------------
ALTER TABLE study_student_data_types
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'document_fill'
    CHECK (scope IN ('university_info', 'document_fill')),
    -- university_info = 대학/학과 정보(글로케어 편집·공개) / document_fill = 서류작성 정보(학생·센터 편집)
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
    -- AI 매칭용 동의어. 예: 보호자_성명 → ['보호자 성명','Guardian name','법정대리인','Người giám hộ']
  ADD COLUMN IF NOT EXISTS is_derived boolean NOT NULL DEFAULT false,
    -- 파생필드 여부 (값을 따로 저장하지 않고 다른 필드에서 해석)
  ADD COLUMN IF NOT EXISTS derived_role text,
    -- 역할 키. 예: 'guardian' (보호자 = 아버지/어머니 중 택1)
  ADD COLUMN IF NOT EXISTS derived_from jsonb;
    -- 파생 매핑. 예: { "selector":"guardian_choice",
    --                  "map": { "father":"father_name", "mother":"mother_name" } }

-- input_type 에 'signature' 추가 (서명 패드 → PNG → 비공개 버킷)
ALTER TABLE study_student_data_types
  DROP CONSTRAINT IF EXISTS study_student_data_types_input_type_check;
ALTER TABLE study_student_data_types
  ADD CONSTRAINT study_student_data_types_input_type_check
  CHECK (input_type IN (
    'text','long_text','date','number','select','multi_select',
    'file','boolean','signature'
  ));

-- 기존 행은 전부 서류작성 정보 → scope 기본값('document_fill')로 충분.
-- (대학정보 표준데이터는 차후 university_info 로 추가)


-- ---------------------------------------------------------------------
-- 3. 통합 뷰 (study_documents) — 입학서류 메뉴 "모아보기"
--    security_invoker = 호출 사용자의 RLS 적용
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW study_documents
  WITH (security_invoker = true) AS
  SELECT s.id::text                                  AS id,
         'guideline'::text                           AS doc_type,
         s.university_id,
         NULL::text                                  AS department_label,
         (s.term || ' · ' || s.program_type)         AS name,
         s.status::text                              AS status,
         s.updated_at
    FROM study_admission_specs s
  UNION ALL
  SELECT f.id::text, 'form', f.university_id,
         f.department_name,
         f.name_ko,
         (CASE WHEN f.is_current THEN 'current' ELSE 'archived' END),
         f.updated_at
    FROM study_admission_form_files f
  UNION ALL
  SELECT r.id::text, 'submission', r.university_id,
         d.name_ko,
         r.name_ko, r.status, r.updated_at
    FROM study_required_submissions r
    LEFT JOIN departments d ON d.id = r.department_id;


-- ---------------------------------------------------------------------
-- 4. (후속, 별도 단계) 보호자 파생필드 시드
--    기존 father_*/mother_* 키를 확인한 뒤,
--    guardian_choice(select: father|mother) + guardian_* 파생필드를 INSERT.
--    → 카탈로그 키 enumerate 후 별도 SQL 로 제공.
-- ---------------------------------------------------------------------
