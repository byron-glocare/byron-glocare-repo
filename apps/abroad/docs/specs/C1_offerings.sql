-- =====================================================================
--  C1 — 모집(offering) 엔티티 신설
--
--  배경 (C_CORE_WORKFLOW_REDESIGN.md):
--   플랫폼의 핵심 가치 = "글로케어가 무엇을 얼마나 모집할지 관리(큐레이션)".
--   지금은 universities/departments 의 active 플래그밖에 없어, "어느 대학/학과/
--   학기를 유학센터에 줄지 + 학기별 몇 명 모집할지"를 표현할 자리가 없다.
--
--  설계 결정 (운영자 컨펌):
--   · study_offerings = 큐레이션 단위 (대학 × 학과 × 학기).
--   · 학기별 모집수(intake_quota) = 글로케어 운영 모집인원. 노출(published) 시 필수.
--       (모집요강 capacity[무제한/30명] 과 별개 — 이건 글로케어가 실제로 받을 인원.)
--   · 모집요강(spec) 과는 명시적 FK(source_spec_id) 로 연결. 단 nullable —
--       큐레이션(1단계)이 모집요강 상세등록(2단계)보다 앞설 수 있다.
--   · 언어트랙(korean/english/chinese) + 학생위치(VN/KR/any) 차원 — 서류 분기용.
--   · 학생 지원(application)은 향후 offering 선택 → study_applications.offering_id 추가.
--       (라이브에 실제 지원 데이터 없음 → 백필 불필요, additive only.)
--
--  ⚠ 전부 additive (신규 테이블 / 컬럼 추가). 기존 테이블 데이터·RLS 그대로.
--     universities·departments·specs·applications 재생성/파괴 없음.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 모집 (study_offerings)
--    큐레이션 단위. 대학 × 학과 × 학기 + 학기별 모집수.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_offerings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  university_id   bigint NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id   bigint NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,

  -- 모집요강(spec) 과 같은 텍스트 라벨. 예: '2026-Spring'
  term            text NOT NULL,

  -- 학기별 모집수 (글로케어 운영 모집인원). 노출 시 필수 (아래 CHECK).
  intake_quota    integer CHECK (intake_quota IS NULL OR intake_quota >= 0),

  -- 수업 언어 트랙. 영어트랙 = TOPIK 대신 영어성적 (학과 레벨 반영용).
  language_track  text NOT NULL DEFAULT 'korean'
                    CHECK (language_track IN ('korean', 'english', 'chinese')),

  -- 학생 현재 위치 범위 — 서류 분기 차원. VN(베트남 체류) / KR(한국 체류, 대개 D-4) / any.
  -- 같은 대학·학과·학기라도 위치별로 필요 서류가 달라질 수 있어 별 offering 으로 분리 가능.
  student_location_scope text NOT NULL DEFAULT 'any'
                    CHECK (student_location_scope IN ('VN', 'KR', 'any')),

  -- draft = 큐레이션 중 / published = 센터 노출(모집중) / closed = 모집 마감 / archived = 보관
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'closed', 'archived')),

  -- 입학정보 원천. 같은 (대학, 학기) spec 을 여러 학과 offering 이 공유.
  -- nullable: 큐레이션이 모집요강 등록보다 앞설 수 있음. spec 승인 시 연결.
  source_spec_id  uuid REFERENCES study_admission_specs(id) ON DELETE SET NULL,

  sort_order      integer NOT NULL DEFAULT 0,
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- 노출(published) offering 은 학기별 모집수 필수
  CONSTRAINT offering_published_needs_quota
    CHECK (status <> 'published' OR intake_quota IS NOT NULL),

  -- 한 대학/학과/학기/언어트랙/위치 조합은 유일
  CONSTRAINT offering_unique_combo
    UNIQUE (university_id, department_id, term, language_track, student_location_scope)
);

CREATE INDEX IF NOT EXISTS idx_offering_university_term
  ON study_offerings(university_id, term);
CREATE INDEX IF NOT EXISTS idx_offering_department
  ON study_offerings(department_id);
CREATE INDEX IF NOT EXISTS idx_offering_source_spec
  ON study_offerings(source_spec_id);
-- 센터 노출 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_offering_published
  ON study_offerings(university_id) WHERE status = 'published';

-- updated_at 자동 갱신 (기존 study_touch_updated_at 재사용)
DROP TRIGGER IF EXISTS trg_study_offerings_updated ON study_offerings;
CREATE TRIGGER trg_study_offerings_updated
  BEFORE UPDATE ON study_offerings
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();

ALTER TABLE study_offerings ENABLE ROW LEVEL SECURITY;

-- 글로케어 어드민: 전체 CRUD (study_required_submissions 패턴 미러)
DROP POLICY IF EXISTS offering_admin_all ON study_offerings;
CREATE POLICY offering_admin_all ON study_offerings
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 인증된 사용자(유학센터 포함): 노출(published) offering 만 read
DROP POLICY IF EXISTS offering_authed_read ON study_offerings;
CREATE POLICY offering_authed_read ON study_offerings
  FOR SELECT
  USING (auth.role() = 'authenticated' AND status = 'published');


-- ---------------------------------------------------------------------
-- 2. 학생 지원 → offering 연결 (study_applications.offering_id)
--    4단계 "학생 입력"에서 희망 = offering(대학/학과/학기) 선택으로 명확화.
--    기존 admission_spec_id / target_department_id 는 당분간 병행 유지.
--    (라이브에 지원 데이터 없음 → nullable 추가만, 백필 불필요.)
-- ---------------------------------------------------------------------
ALTER TABLE study_applications
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES study_offerings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_application_offering
  ON study_applications(offering_id);
