-- =====================================================================
--  C5 — 학생별 제출서류 파일 (서류 등록 통합)
--
--  운영자 결정: '제출해야 할 서류 = 학생이 올리는 파일'. 제출서류 목록의 각 항목에
--  업로드 슬롯을 붙이고, 학생별로 올린 파일을 이 테이블에 보관한다.
--  (기존 '파일 타입 표준데이터' 별도 섹션은 폐지 — 제출서류로 통합.)
--
--  파일 실체는 비공개 버킷 student-files 에 저장, 여기엔 path/메타만.
--  학생당 제출서류 1파일(교체) — UNIQUE(student_id, submission_id).
-- =====================================================================

CREATE TABLE IF NOT EXISTS study_student_submission_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES study_managed_students(id) ON DELETE CASCADE,
  submission_id  uuid NOT NULL REFERENCES study_required_submissions(id) ON DELETE CASCADE,
  file_path      text NOT NULL,   -- student-files 비공개 버킷 path
  file_name      text NOT NULL,
  size_bytes     integer,
  mime_type      text,
  uploaded_by    uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sssf_unique UNIQUE (student_id, submission_id)
);

CREATE INDEX IF NOT EXISTS idx_sssf_student
  ON study_student_submission_files(student_id);
CREATE INDEX IF NOT EXISTS idx_sssf_submission
  ON study_student_submission_files(submission_id);

DROP TRIGGER IF EXISTS trg_sssf_updated ON study_student_submission_files;
CREATE TRIGGER trg_sssf_updated
  BEFORE UPDATE ON study_student_submission_files
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();

ALTER TABLE study_student_submission_files ENABLE ROW LEVEL SECURITY;

-- 글로케어 어드민: 전체
DROP POLICY IF EXISTS sssf_admin_all ON study_student_submission_files;
CREATE POLICY sssf_admin_all ON study_student_submission_files
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 유학센터 사용자: 자기 org 학생의 파일만 (data_values 패턴 미러)
DROP POLICY IF EXISTS sssf_center_user ON study_student_submission_files;
CREATE POLICY sssf_center_user ON study_student_submission_files
  FOR ALL
  USING (
    student_id IN (
      SELECT id FROM study_managed_students
      WHERE org_id IN (SELECT study_my_org_ids())
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM study_managed_students
      WHERE org_id IN (SELECT study_my_org_ids())
    )
  );
