-- ============================================================
-- B4-4 — 학생별 표준 데이터 값 저장
--
-- 카탈로그 (study_student_data_types) 에서 정의된 각 키별로
-- 학생이 입력한 값을 저장. JSONB 로 입력 타입 유연 처리.
--
-- value JSONB 구조 (input_type 별):
--   text / long_text:  "string"
--   date:              "YYYY-MM-DD"
--   number:            42
--   select:            "value_string"
--   multi_select:      ["v1","v2"]
--   boolean:           true|false
--   file:              {url, file_name, size_bytes, mime_type}
-- ============================================================

CREATE TABLE study_student_data_values (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES study_managed_students(id) ON DELETE CASCADE,
  data_type_key   text NOT NULL,    -- study_student_data_types.key (FK 미사용 — 마스터 변경 안정성)
  value           jsonb NOT NULL,
  filled_by       uuid REFERENCES auth.users(id),
  filled_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (student_id, data_type_key)
);

CREATE INDEX idx_study_student_data_values_student
  ON study_student_data_values (student_id);

CREATE INDEX idx_study_student_data_values_key
  ON study_student_data_values (data_type_key);

CREATE TRIGGER trg_study_student_data_values_updated
  BEFORE UPDATE ON study_student_data_values
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- ============================================================
-- RLS — 유학센터 사용자는 자기 org 학생의 데이터만
-- ============================================================
ALTER TABLE study_student_data_values ENABLE ROW LEVEL SECURITY;

-- 글로케어 어드민: 전체 CRUD
CREATE POLICY data_values_admin_all ON study_student_data_values
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 유학센터 사용자: 자기 org 학생의 데이터만 CRUD
CREATE POLICY data_values_center_user ON study_student_data_values
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
