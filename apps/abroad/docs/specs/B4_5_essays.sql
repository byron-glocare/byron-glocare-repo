-- ============================================================
-- B4-5 — AI 작문 도우미 (서술형 양식 자동 작성 지원)
--
-- 1) 양식별 서술형 질문 정의 — form_files.essay_questions JSONB
-- 2) 학생별 작문 결과 저장 — study_student_essay_drafts
-- ============================================================

-- ============================================================
-- 1. study_admission_form_files.essay_questions
--    형식: [
--      {
--        question_ko: "한국 유학을 결심한 계기는 무엇입니까?",
--        question_vi: "Lý do bạn quyết định du học Hàn Quốc?" (선택),
--        max_chars: 500 (선택),
--        basis_data_type_keys: ["essay_motivation_korea", "essay_korea_culture_exp"]
--      },
--      ...
--    ]
-- ============================================================
ALTER TABLE study_admission_form_files
  ADD COLUMN IF NOT EXISTS essay_questions jsonb NOT NULL DEFAULT '[]'::jsonb;


-- ============================================================
-- 2. study_student_essay_drafts
--    학생 + 양식 + 질문 인덱스별 작문 결과.
-- ============================================================
CREATE TABLE study_student_essay_drafts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES study_managed_students(id) ON DELETE CASCADE,
  form_file_id      uuid NOT NULL REFERENCES study_admission_form_files(id) ON DELETE CASCADE,
  question_index    int  NOT NULL CHECK (question_index >= 0),

  -- 질문 스냅샷 (양식 갱신 시 작문 결과가 어떤 질문에 대한 것인지 보존)
  question_ko       text NOT NULL,
  basis_data_keys   text[] NOT NULL DEFAULT '{}',

  -- AI 생성 결과
  generated_text    text,
  generated_at      timestamptz,
  generation_model  text,
  generation_usage  jsonb,         -- {input_tokens, output_tokens, ...}

  -- 운영자/학생이 다듬은 최종본 (없으면 generated_text 사용)
  edited_text       text,
  edited_at         timestamptz,
  edited_by         uuid REFERENCES auth.users(id),

  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (student_id, form_file_id, question_index)
);

CREATE INDEX idx_study_essay_drafts_student
  ON study_student_essay_drafts (student_id);

CREATE INDEX idx_study_essay_drafts_form
  ON study_student_essay_drafts (form_file_id);

CREATE TRIGGER trg_study_essay_drafts_updated
  BEFORE UPDATE ON study_student_essay_drafts
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE study_student_essay_drafts ENABLE ROW LEVEL SECURITY;

-- 글로케어 어드민: 전체
CREATE POLICY essay_drafts_admin_all ON study_student_essay_drafts
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 유학센터: 자기 org 학생의 작문만
CREATE POLICY essay_drafts_center_user ON study_student_essay_drafts
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
