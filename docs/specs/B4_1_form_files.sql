-- ============================================================
-- B4-1 — 모집요강 양식 파일 (입학원서·자기소개서·학업계획서 등)
--
-- 대학교 단위 첨부 + 학과별 override 가능.
-- 버전 관리: 같은 (university_id, department_name, key) 의 새 업로드 시
--             이전 row 는 is_current=false 로 archive.
--
-- 적용 위치: Supabase SQL Editor 에서 한 번 실행.
-- 적용 후: Supabase Console → Storage → Bucket 생성 절차 안내 (이 파일 하단 주석 참고)
-- ============================================================

-- 1. 테이블
CREATE TABLE study_admission_form_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id     bigint NOT NULL REFERENCES universities(id) ON DELETE CASCADE,

  -- null = 대학 전체 적용
  -- 값  = 해당 학과명에만 적용 (학과별 override)
  department_name   text,

  -- 양식 종류 (분류용)
  key               text NOT NULL CHECK (key IN (
    'application_form',          -- 입학원서
    'self_intro',                -- 자기소개서
    'study_plan',                -- 학업계획서
    'financial_pledge_form',     -- 재정보증서
    'privacy_consent',           -- 개인정보 동의서
    'academic_record_release',   -- 학적정보 제공 동의서
    'recommendation_letter',     -- 추천서
    'health_certificate',        -- 건강진단서 양식
    'other'                      -- 기타
  )),

  -- 표시명 (운영자가 입력. 예: "2026학년도 외국인 특별전형 입학원서")
  name_ko           text NOT NULL,

  -- Supabase Storage URL (공개 read 또는 signed)
  file_url          text NOT NULL,
  file_name         text NOT NULL,                    -- 원본 파일명 (확장자 포함)
  size_bytes        bigint,
  mime_type         text,

  -- 버전 관리
  is_current        boolean NOT NULL DEFAULT true,
  superseded_by     uuid REFERENCES study_admission_form_files(id) ON DELETE SET NULL,

  -- 메타
  uploaded_by       uuid REFERENCES auth.users(id),
  uploaded_at       timestamptz NOT NULL DEFAULT NOW(),
  notes             text,

  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

-- 같은 (대학, 학과, 양식) 조합에 is_current=true 는 1개만
CREATE UNIQUE INDEX uniq_study_form_files_current
  ON study_admission_form_files (university_id, COALESCE(department_name, ''), key)
  WHERE is_current = true;

CREATE INDEX idx_study_form_files_university
  ON study_admission_form_files (university_id)
  WHERE is_current = true;

CREATE INDEX idx_study_form_files_dept
  ON study_admission_form_files (university_id, department_name)
  WHERE is_current = true AND department_name IS NOT NULL;

CREATE TRIGGER trg_study_form_files_updated
  BEFORE UPDATE ON study_admission_form_files
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE study_admission_form_files ENABLE ROW LEVEL SECURITY;

-- 글로케어 어드민: 전체 CRUD
CREATE POLICY form_files_admin_all ON study_admission_form_files
  FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  );

-- 인증된 사용자 (유학센터 포함): 현재(is_current=true) 양식만 read
CREATE POLICY form_files_authed_read_current ON study_admission_form_files
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND is_current = true
  );


-- ============================================================
-- 3. Supabase Storage 버킷 생성 (Supabase Console → Storage)
-- ============================================================
-- 1. Supabase Dashboard 접속
-- 2. Storage 탭 → New bucket
-- 3. Name: admission-form-files
-- 4. Public bucket: ✅ ON (양식은 공개 파일)
-- 5. File size limit: 30 MB
-- 6. Allowed MIME types (비워두면 모두 허용 — HWP/PDF/DOCX 등):
--      application/pdf, application/x-hwp, application/vnd.hancom.hwpx,
--      application/vnd.openxmlformats-officedocument.wordprocessingml.document
--
-- 4. Bucket Policies (Supabase Console → Storage → Policies → admission-form-files):
--    - INSERT/UPDATE/DELETE: glocare_admin role 만
--    - SELECT: anyone (public bucket 이므로 자동)
--
-- 또는 SQL Editor 에서 아래 실행 (service_role 권한 필요):
/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admission-form-files',
  'admission-form-files',
  true,
  31457280,
  ARRAY[
    'application/pdf',
    'application/x-hwp',
    'application/vnd.hancom.hwpx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 운영자만 업로드 가능
CREATE POLICY "Admin can upload form files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'admission-form-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  );

-- 운영자만 수정/삭제 가능
CREATE POLICY "Admin can update form files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'admission-form-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  );

CREATE POLICY "Admin can delete form files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'admission-form-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  );
*/
