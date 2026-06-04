-- =============================================================
-- GLOCARE B4 통합 마이그레이션 (운영 시작용)
-- =============================================================
-- 사용자가 붙여넣은 현재 schema 분석 결과:
--   ✓ 이미 있음: study_admission_specs, study_applications, study_center_orgs,
--                study_center_users, study_invoices, study_managed_students,
--                study_pricing_plans, study_settlements, study_timelines 등
--   ✗ 추가 필요:
--     - study_admission_form_files (B4-1)
--     - study_student_data_types + 시드 (B4-2)
--     - study_student_data_values (B4-4)
--     - study_student_essay_drafts + form_files.essay_questions 컬럼 (B4-5)
--     - form_files.required_data_type_keys 컬럼 (B4-3)
--     - Storage 버킷 admission-form-files
--     - 어드민 role 메타데이터
--
-- Supabase SQL Editor 에서 위에서 아래로 한 번에 실행.
-- =============================================================


-- =============================================================
-- 0. 어드민 role 메타데이터 — 이게 안 되면 모든 RLS 막힘
-- =============================================================
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"glocare_admin"}'::jsonb
WHERE email IN ('byron@glocare.co.kr', 'kajkaj202@gmail.com');

-- 확인 (결과 row 2개, 둘 다 role=glocare_admin 이어야 함)
SELECT email, raw_app_meta_data->>'role' AS role
FROM auth.users
WHERE email IN ('byron@glocare.co.kr', 'kajkaj202@gmail.com');


-- =============================================================
-- 1. study_admission_form_files (B4-1) — 양식 파일 마스터
-- =============================================================
CREATE TABLE IF NOT EXISTS study_admission_form_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id     bigint NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_name   text,
  key               text NOT NULL CHECK (key IN (
    'application_form','self_intro','study_plan','financial_pledge_form',
    'privacy_consent','academic_record_release','recommendation_letter',
    'health_certificate','other'
  )),
  name_ko           text NOT NULL,
  file_url          text NOT NULL,
  file_name         text NOT NULL,
  size_bytes        bigint,
  mime_type         text,
  is_current        boolean NOT NULL DEFAULT true,
  superseded_by     uuid REFERENCES study_admission_form_files(id) ON DELETE SET NULL,
  uploaded_by       uuid REFERENCES auth.users(id),
  uploaded_at       timestamptz NOT NULL DEFAULT NOW(),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_study_form_files_current
  ON study_admission_form_files (university_id, COALESCE(department_name, ''), key)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_study_form_files_university
  ON study_admission_form_files (university_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_study_form_files_dept
  ON study_admission_form_files (university_id, department_name)
  WHERE is_current = true AND department_name IS NOT NULL;

-- updated_at 트리거 함수가 study_touch_updated_at() 인지 다른 이름인지 확인
-- B1_schema.sql 에서 study_touch_updated_at() 사용. 없으면 만들기:
CREATE OR REPLACE FUNCTION study_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_study_form_files_updated ON study_admission_form_files;
CREATE TRIGGER trg_study_form_files_updated
  BEFORE UPDATE ON study_admission_form_files
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();

ALTER TABLE study_admission_form_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS form_files_admin_all ON study_admission_form_files;
CREATE POLICY form_files_admin_all ON study_admission_form_files
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

DROP POLICY IF EXISTS form_files_authed_read_current ON study_admission_form_files;
CREATE POLICY form_files_authed_read_current ON study_admission_form_files
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_current = true);


-- =============================================================
-- 2. study_student_data_types (B4-2) — 표준 데이터 카탈로그
-- =============================================================
CREATE TABLE IF NOT EXISTS study_student_data_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text NOT NULL UNIQUE,
  label_ko        text NOT NULL,
  label_vi        text NOT NULL,
  category        text NOT NULL CHECK (category IN (
    'identity','education','family','financial','language',
    'contact','career','essay','document','other'
  )),
  input_type      text NOT NULL CHECK (input_type IN (
    'text','long_text','date','number','select','multi_select','file','boolean'
  )),
  options         jsonb,
  hint_ko         text,
  hint_vi         text,
  is_essay_basis  boolean NOT NULL DEFAULT false,
  is_default_required boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_student_data_types_category
  ON study_student_data_types (category, sort_order)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_study_student_data_types_updated ON study_student_data_types;
CREATE TRIGGER trg_study_student_data_types_updated
  BEFORE UPDATE ON study_student_data_types
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();

ALTER TABLE study_student_data_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_types_admin_all ON study_student_data_types;
CREATE POLICY data_types_admin_all ON study_student_data_types
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

DROP POLICY IF EXISTS data_types_authed_read ON study_student_data_types;
CREATE POLICY data_types_authed_read ON study_student_data_types
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);


-- =============================================================
-- 3. form_files 에 컬럼 추가 (B4-3, B4-5)
-- =============================================================
ALTER TABLE study_admission_form_files
  ADD COLUMN IF NOT EXISTS required_data_type_keys text[] NOT NULL DEFAULT '{}';

ALTER TABLE study_admission_form_files
  ADD COLUMN IF NOT EXISTS essay_questions jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_study_form_files_required_keys
  ON study_admission_form_files USING GIN (required_data_type_keys);


-- =============================================================
-- 4. study_student_data_values (B4-4) — 학생별 데이터 값
-- =============================================================
CREATE TABLE IF NOT EXISTS study_student_data_values (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES study_managed_students(id) ON DELETE CASCADE,
  data_type_key   text NOT NULL,
  value           jsonb NOT NULL,
  filled_by       uuid REFERENCES auth.users(id),
  filled_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, data_type_key)
);

CREATE INDEX IF NOT EXISTS idx_study_student_data_values_student
  ON study_student_data_values (student_id);

CREATE INDEX IF NOT EXISTS idx_study_student_data_values_key
  ON study_student_data_values (data_type_key);

DROP TRIGGER IF EXISTS trg_study_student_data_values_updated ON study_student_data_values;
CREATE TRIGGER trg_study_student_data_values_updated
  BEFORE UPDATE ON study_student_data_values
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();

ALTER TABLE study_student_data_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_values_admin_all ON study_student_data_values;
CREATE POLICY data_values_admin_all ON study_student_data_values
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 유학센터 사용자: 자기 org 학생의 데이터만
-- (study_my_org_ids() 함수가 B1_schema 에 정의되어 있어야 함)
DROP POLICY IF EXISTS data_values_center_user ON study_student_data_values;
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


-- =============================================================
-- 5. study_student_essay_drafts (B4-5) — AI 작문 결과
-- =============================================================
CREATE TABLE IF NOT EXISTS study_student_essay_drafts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES study_managed_students(id) ON DELETE CASCADE,
  form_file_id      uuid NOT NULL REFERENCES study_admission_form_files(id) ON DELETE CASCADE,
  question_index    int  NOT NULL CHECK (question_index >= 0),
  question_ko       text NOT NULL,
  basis_data_keys   text[] NOT NULL DEFAULT '{}',
  generated_text    text,
  generated_at      timestamptz,
  generation_model  text,
  generation_usage  jsonb,
  edited_text       text,
  edited_at         timestamptz,
  edited_by         uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, form_file_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_study_essay_drafts_student
  ON study_student_essay_drafts (student_id);

CREATE INDEX IF NOT EXISTS idx_study_essay_drafts_form
  ON study_student_essay_drafts (form_file_id);

DROP TRIGGER IF EXISTS trg_study_essay_drafts_updated ON study_student_essay_drafts;
CREATE TRIGGER trg_study_essay_drafts_updated
  BEFORE UPDATE ON study_student_essay_drafts
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();

ALTER TABLE study_student_essay_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS essay_drafts_admin_all ON study_student_essay_drafts;
CREATE POLICY essay_drafts_admin_all ON study_student_essay_drafts
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

DROP POLICY IF EXISTS essay_drafts_center_user ON study_student_essay_drafts;
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


-- =============================================================
-- 6. Storage 버킷 + 정책 (admission-form-files)
-- =============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admission-form-files',
  'admission-form-files',
  true,
  31457280, -- 30MB
  ARRAY[
    'application/pdf',
    'application/x-hwp',
    'application/vnd.hancom.hwpx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 기존 정책 제거 (idempotent)
DROP POLICY IF EXISTS "form_files_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "form_files_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "form_files_admin_delete" ON storage.objects;

-- 어드민만 upload/update/delete
CREATE POLICY "form_files_admin_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'admission-form-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  );

CREATE POLICY "form_files_admin_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'admission-form-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  );

CREATE POLICY "form_files_admin_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'admission-form-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin'
  );

-- public bucket 이므로 SELECT 는 자동 (별도 policy 불필요)


-- =============================================================
-- 7. 데이터 카탈로그 시드 (B4-2) — 60+ 항목
-- =============================================================
INSERT INTO study_student_data_types
  (key, label_ko, label_vi, category, input_type, hint_ko, hint_vi, is_essay_basis, is_default_required, sort_order)
VALUES
-- 신원
('full_name_ko',      '한국식 이름',      'Họ tên (Hàn Quốc)',         'identity', 'text',   '한국식 표기', NULL, false, true, 10),
('full_name_en',      '영문 이름',        'Họ tên (Tiếng Anh)',        'identity', 'text',   '여권 표기와 일치', 'Trùng với hộ chiếu', false, true, 11),
('full_name_vi',      '베트남식 이름',    'Họ tên (Tiếng Việt)',       'identity', 'text',   '베트남식 표기', NULL, false, true, 12),
('full_name_hanja',   '한자 이름',        'Họ tên (Hán tự, nếu có)',   'identity', 'text',   '없으면 비워두세요', 'Để trống nếu không có', false, false, 13),
('birth_date',        '생년월일',         'Ngày sinh',                 'identity', 'date',   NULL, NULL, false, true, 20),
('gender',            '성별',             'Giới tính',                 'identity', 'select', NULL, NULL, false, true, 21),
('nationality',       '국적',             'Quốc tịch',                 'identity', 'text',   '예: 베트남', 'VD: Việt Nam', false, true, 22),
('passport_no',       '여권 번호',        'Số hộ chiếu',               'identity', 'text',   NULL, NULL, false, true, 30),
('passport_issued',   '여권 발급일',      'Ngày cấp hộ chiếu',         'identity', 'date',   NULL, NULL, false, false, 31),
('passport_expiry',   '여권 만료일',      'Ngày hết hạn hộ chiếu',     'identity', 'date',   NULL, NULL, false, true, 32),
('residence_city_vn', '베트남 거주 도시', 'Thành phố cư trú (Việt Nam)', 'identity', 'text', NULL, NULL, false, true, 40),
('residence_addr_vn', '베트남 거주 주소', 'Địa chỉ cư trú (Việt Nam)', 'identity', 'long_text', '상세 주소', 'Địa chỉ đầy đủ', false, true, 41),
-- 학력
('highschool_name',          '고등학교 이름',         'Tên trường cấp 3',                'education', 'text',   NULL, NULL, false, true, 50),
('highschool_location',      '고등학교 소재지',       'Địa điểm trường',                 'education', 'text',   '도시·국가', NULL, false, false, 51),
('highschool_grad_date',     '고등학교 졸업일',       'Ngày tốt nghiệp cấp 3',           'education', 'date',   NULL, NULL, false, true, 52),
('highschool_gpa',           '고등학교 GPA',          'GPA cấp 3',                       'education', 'number', NULL, NULL, false, false, 53),
('highschool_gpa_scale',     'GPA 만점',              'Thang điểm GPA',                  'education', 'select', '예: 10점, 4.0', NULL, false, false, 54),
('bachelor_university',      '대학 이름 (있을 시)',   'Tên trường đại học (nếu có)',     'education', 'text',   NULL, NULL, false, false, 60),
('bachelor_major',           '전공 (있을 시)',        'Chuyên ngành (nếu có)',           'education', 'text',   NULL, NULL, false, false, 61),
('bachelor_grad_date',       '대학 졸업일 (있을 시)', 'Ngày tốt nghiệp đại học (nếu có)', 'education', 'date',  NULL, NULL, false, false, 62),
-- 가족
('father_name',       '아버지 이름',        'Tên cha',                'family', 'text',   NULL, NULL, false, true, 70),
('father_occupation', '아버지 직업',        'Nghề nghiệp cha',        'family', 'text',   NULL, NULL, false, true, 71),
('father_contact',    '아버지 연락처',      'Số điện thoại cha',      'family', 'text',   NULL, NULL, false, false, 72),
('father_birth_date', '아버지 생년월일',    'Ngày sinh cha',          'family', 'date',   NULL, NULL, false, false, 73),
('mother_name',       '어머니 이름',        'Tên mẹ',                 'family', 'text',   NULL, NULL, false, true, 80),
('mother_occupation', '어머니 직업',        'Nghề nghiệp mẹ',         'family', 'text',   NULL, NULL, false, true, 81),
('mother_contact',    '어머니 연락처',      'Số điện thoại mẹ',       'family', 'text',   NULL, NULL, false, false, 82),
('mother_birth_date', '어머니 생년월일',    'Ngày sinh mẹ',           'family', 'date',   NULL, NULL, false, false, 83),
('siblings_count',    '형제자매 수',        'Số anh chị em',          'family', 'number', NULL, NULL, false, false, 90),
('guardian_name',     '보호자 이름',        'Tên người giám hộ',      'family', 'text',   '본인이 아닌 경우', 'Nếu không phải bản thân', false, false, 95),
('guardian_relation', '보호자 관계',        'Quan hệ với người giám hộ', 'family', 'text', NULL, NULL, false, false, 96),
-- 재정
('sponsor_name',          '재정보증인 이름',   'Tên người bảo lãnh tài chính', 'financial', 'text',   '대부분 부모', 'Thường là cha mẹ', false, true, 100),
('sponsor_relation',      '보증인 관계',        'Quan hệ với người bảo lãnh',   'financial', 'text',   NULL, NULL, false, true, 101),
('sponsor_occupation',    '보증인 직업',        'Nghề nghiệp người bảo lãnh',   'financial', 'text',   NULL, NULL, false, true, 102),
('sponsor_monthly_income','보증인 월 소득',     'Thu nhập tháng (KRW/VND)',     'financial', 'number', '단위 협의', NULL, false, false, 103),
('bank_name',             '은행명',             'Tên ngân hàng',                'financial', 'text',   NULL, NULL, false, true, 110),
('bank_balance_amount',   '잔고 (KRW 환산)',    'Số dư (quy đổi KRW)',          'financial', 'number', '재정보증 금액', NULL, false, true, 111),
('bank_account_no',       '계좌 번호',          'Số tài khoản',                 'financial', 'text',   '뒷자리 4자리만도 가능', NULL, false, false, 112),
('financial_proof_issued','잔고증명서 발급일',  'Ngày cấp giấy chứng minh tài chính', 'financial', 'date', NULL, NULL, false, false, 113),
-- 어학
('topik_level',           'TOPIK 등급',         'Cấp độ TOPIK',                 'language', 'select', '1~6급', '1-6', false, false, 120),
('topik_score',           'TOPIK 점수',         'Điểm TOPIK',                   'language', 'number', NULL, NULL, false, false, 121),
('topik_test_date',       'TOPIK 응시일',       'Ngày thi TOPIK',               'language', 'date',   NULL, NULL, false, false, 122),
('korean_alt_method',     '한국어 대체 인증',   'Chứng nhận tiếng Hàn khác',    'language', 'text',   '예: 세종학당 4급', NULL, false, false, 125),
('english_test_type',     '영어 시험 종류',     'Loại kỳ thi tiếng Anh',        'language', 'text',   '예: TOEFL, IELTS', NULL, false, false, 130),
('english_test_score',    '영어 시험 점수',     'Điểm tiếng Anh',               'language', 'text',   NULL, NULL, false, false, 131),
-- 연락처
('student_phone',     '학생 전화번호',  'Số điện thoại (sinh viên)', 'contact', 'text',   '국가코드 포함', 'Bao gồm mã quốc gia', false, true, 140),
('student_email',     '학생 이메일',    'Email (sinh viên)',         'contact', 'text',   NULL, NULL, false, true, 141),
('student_kakao',     '카카오톡 ID',    'KakaoTalk ID',              'contact', 'text',   NULL, NULL, false, false, 142),
('student_zalo',      'Zalo ID',        'Zalo ID',                   'contact', 'text',   NULL, NULL, false, false, 143),
-- 경력·자격
('work_experience',     '근무·실습 경력',   'Kinh nghiệm làm việc/thực tập', 'career', 'long_text', '회사·기간·역할', NULL, false, false, 150),
('certifications',      '자격증',           'Chứng chỉ',                     'career', 'long_text', NULL, NULL, false, false, 151),
-- 서술형 (AI 작문 기초)
('essay_motivation_korea',    '한국 유학 결심 계기',     'Lý do quyết định du học Hàn Quốc', 'essay', 'long_text',
  '한국의 매력, 영향 받은 경험·매체·사람, 실제 사례. AI 가 양식별 질문에 맞게 작문',
  'Điểm hấp dẫn của Hàn, ảnh hưởng từ trải nghiệm, ví dụ. AI sẽ soạn theo câu hỏi',
  true, false, 200),
('essay_major_motivation',    '학과 선택 이유 기초',     'Lý do chọn ngành (cơ sở)',        'essay', 'long_text',
  '이 학과에 끌리는 이유, 관련 경험, 진로 연관성',
  'Lý do quan tâm ngành, kinh nghiệm liên quan, gắn với nghề nghiệp',
  true, false, 201),
('essay_study_plan_basis',    '학업 계획 기초',          'Kế hoạch học tập (cơ sở)',        'essay', 'long_text',
  '입학 후 학기별 학습·역량 계획',
  'Kế hoạch học và phát triển năng lực theo học kỳ',
  true, false, 202),
('essay_career_plan',         '졸업 후 진로 계획',       'Kế hoạch sau tốt nghiệp',         'essay', 'long_text',
  '한국/베트남에서 하고 싶은 일, 가교 역할',
  'Muốn làm gì ở Hàn/Việt, vai trò cầu nối',
  true, false, 203),
('essay_self_intro',          '자기 소개 기초',          'Tự giới thiệu (cơ sở)',           'essay', 'long_text',
  '성격, 강약점, 가치관, 가족 영향',
  'Tính cách, ưu/nhược, giá trị quan, ảnh hưởng gia đình',
  true, false, 204),
('essay_korea_culture_exp',   '한국 문화·언어 경험',     'Trải nghiệm văn hóa/ngôn ngữ Hàn', 'essay', 'long_text',
  '한국어 학습, K-pop, 드라마, 교류 경험',
  'Học tiếng Hàn, K-pop, phim, giao lưu',
  true, false, 205),
('essay_strengths_weakness',  '본인 강점·약점',          'Ưu điểm và nhược điểm',           'essay', 'long_text',
  '구체 예시. 약점은 극복 노력 포함',
  'Kèm ví dụ. Nhược điểm nên có nỗ lực khắc phục',
  true, false, 206),
('essay_special_experience',  '특별한 경험·성취',        'Trải nghiệm/thành tích đặc biệt', 'essay', 'long_text',
  '대회, 봉사, 리더십, 도전',
  'Giải thưởng, tình nguyện, lãnh đạo, thử thách',
  true, false, 207),
-- 첨부 파일
('document_photo',            '증명사진',           'Ảnh thẻ',                        'document', 'file', '여권 규격', NULL, false, true, 300),
('document_passport_copy',    '여권 사본',          'Bản sao hộ chiếu',               'document', 'file', NULL, NULL, false, true, 301),
('document_birth_cert',       '출생증명서',         'Giấy khai sinh',                 'document', 'file', NULL, NULL, false, false, 302),
('document_family_cert',      '가족관계증명서',     'Giấy chứng nhận quan hệ gia đình', 'document', 'file', NULL, NULL, false, false, 303),
('document_highschool_diploma','고등학교 졸업증명서','Bằng tốt nghiệp cấp 3',          'document', 'file', NULL, NULL, false, true, 304),
('document_highschool_transcript','고등학교 성적증명서','Bảng điểm cấp 3',             'document', 'file', NULL, NULL, false, true, 305),
('document_bank_balance',     '잔고증명서',         'Giấy chứng nhận số dư',          'document', 'file', NULL, NULL, false, true, 306),
('document_topik_cert',       'TOPIK 성적표',       'Chứng chỉ TOPIK',                'document', 'file', NULL, NULL, false, false, 307)
ON CONFLICT (key) DO NOTHING;

-- select 옵션 채우기
UPDATE study_student_data_types
SET options = '[{"value":"male","label_ko":"남성","label_vi":"Nam"},{"value":"female","label_ko":"여성","label_vi":"Nữ"},{"value":"other","label_ko":"기타","label_vi":"Khác"}]'::jsonb
WHERE key = 'gender';

UPDATE study_student_data_types
SET options = '[{"value":"10","label_ko":"10점 만점","label_vi":"Thang 10"},{"value":"4.5","label_ko":"4.5점 만점","label_vi":"Thang 4.5"},{"value":"4.0","label_ko":"4.0점 만점","label_vi":"Thang 4.0"},{"value":"100","label_ko":"100점 만점","label_vi":"Thang 100"}]'::jsonb
WHERE key = 'highschool_gpa_scale';

UPDATE study_student_data_types
SET options = '[{"value":"1","label_ko":"1급","label_vi":"Cấp 1"},{"value":"2","label_ko":"2급","label_vi":"Cấp 2"},{"value":"3","label_ko":"3급","label_vi":"Cấp 3"},{"value":"4","label_ko":"4급","label_vi":"Cấp 4"},{"value":"5","label_ko":"5급","label_vi":"Cấp 5"},{"value":"6","label_ko":"6급","label_vi":"Cấp 6"}]'::jsonb
WHERE key = 'topik_level';


-- =============================================================
-- 8. 적용 결과 검증 (이 SELECT 들 모두 정상 결과 나오면 OK)
-- =============================================================
SELECT 'study_admission_form_files' AS table_name, count(*) AS row_count FROM study_admission_form_files
UNION ALL SELECT 'study_student_data_types', count(*) FROM study_student_data_types
UNION ALL SELECT 'study_student_data_values', count(*) FROM study_student_data_values
UNION ALL SELECT 'study_student_essay_drafts', count(*) FROM study_student_essay_drafts;
-- 기대: data_types row_count = 68. 나머지는 0.

SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'admission-form-files';
-- 기대: 1 row, public=true, file_size_limit=31457280.
