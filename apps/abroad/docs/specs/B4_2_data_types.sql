-- ============================================================
-- B4-2 — 표준 데이터 타입 카탈로그
--
-- 한국 대학 외국인 입학 양식이 학생에게 요구하는 정보의 표준화.
-- 양식마다 대동소이 → 같은 정보를 다시 묻지 않기 위해 카탈로그화.
--
-- 시드 데이터는 PoC step1 의 4개 표준 HWP 양식
-- (입학원서·자기소개서·학업계획서·재정보증서) 분석 기반.
--
-- 적용: Supabase SQL Editor 에서 한 번 실행.
-- ============================================================

CREATE TABLE study_student_data_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 식별자 (코드에서 사용. snake_case)
  key             text NOT NULL UNIQUE,

  -- 라벨
  label_ko        text NOT NULL,
  label_vi        text NOT NULL,

  -- 분류
  category        text NOT NULL CHECK (category IN (
    'identity',      -- 신원
    'education',     -- 학력
    'family',        -- 가족
    'financial',     -- 재정
    'language',      -- 어학
    'contact',       -- 연락처
    'career',        -- 경력·자격
    'essay',         -- 서술형 (작문 기초 데이터)
    'document',      -- 첨부 파일
    'other'
  )),

  -- 입력 형식
  input_type      text NOT NULL CHECK (input_type IN (
    'text',          -- 단문 텍스트
    'long_text',     -- 장문 (textarea, 여러 줄)
    'date',          -- 날짜 (YYYY-MM-DD)
    'number',        -- 정수·실수
    'select',        -- 단일 선택 (options 필수)
    'multi_select',  -- 복수 선택
    'file',          -- 파일 업로드
    'boolean'        -- 예/아니오
  )),

  -- select / multi_select 의 선택지 [{value, label_ko, label_vi}]
  options         jsonb,

  -- 입력 안내 (특히 서술형은 무엇을 적을지 가이드)
  hint_ko         text,
  hint_vi         text,

  -- 서술형 작문의 기초 데이터인지 (AI 작문 생성 시 사용)
  -- 예: "한국 유학 결심 계기" 기초 데이터 → 양식의 "왜 한국을 선택했나요?" 질문 답변에 활용
  is_essay_basis  boolean NOT NULL DEFAULT false,

  -- 입력 필수 여부 기본값 (대부분 false — 양식별로 결정)
  is_default_required boolean NOT NULL DEFAULT false,

  -- 표시 순서
  sort_order      integer NOT NULL DEFAULT 0,

  -- 활성화 (운영자가 비활성화 가능)
  is_active       boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_student_data_types_category
  ON study_student_data_types (category, sort_order)
  WHERE is_active = true;

CREATE TRIGGER trg_study_student_data_types_updated
  BEFORE UPDATE ON study_student_data_types
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE study_student_data_types ENABLE ROW LEVEL SECURITY;

-- 글로케어 어드민: 전체 CRUD
CREATE POLICY data_types_admin_all ON study_student_data_types
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 인증 사용자 (유학센터): 활성 카탈로그 read
CREATE POLICY data_types_authed_read ON study_student_data_types
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);


-- ============================================================
-- 양식 ↔ 데이터 타입 매핑 (B4-3)
--   양식이 학생에게 요구하는 데이터 타입 목록.
-- ============================================================
ALTER TABLE study_admission_form_files
  ADD COLUMN IF NOT EXISTS required_data_type_keys text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_study_form_files_required_keys
  ON study_admission_form_files USING GIN (required_data_type_keys);


-- ============================================================
-- 시드 데이터
-- ============================================================
INSERT INTO study_student_data_types
  (key, label_ko, label_vi, category, input_type, hint_ko, hint_vi, is_essay_basis, is_default_required, sort_order)
VALUES
-- 신원
('full_name_ko',      '한국식 이름',      'Họ tên (Hàn Quốc)',         'identity', 'text',   '한국식 표기 (예: 응웬 반 안 → 응웬 반 안)', NULL, false, true, 10),
('full_name_en',      '영문 이름',        'Họ tên (Tiếng Anh)',        'identity', 'text',   '여권 표기와 일치', 'Trùng với hộ chiếu', false, true, 11),
('full_name_vi',      '베트남식 이름',    'Họ tên (Tiếng Việt)',       'identity', 'text',   '베트남식 (예: Nguyen Van Anh)', NULL, false, true, 12),
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
('highschool_gpa_scale',     'GPA 만점',              'Thang điểm GPA',                  'education', 'select', '예: 10점, 4.0, 100점', NULL, false, false, 54),
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
('sponsor_monthly_income','보증인 월 소득',     'Thu nhập tháng (KRW/VND)',     'financial', 'number', '대학 양식에 따라 KRW 또는 VND', NULL, false, false, 103),
('bank_name',             '은행명',             'Tên ngân hàng',                'financial', 'text',   NULL, NULL, false, true, 110),
('bank_balance_amount',   '잔고 (KRW 환산)',    'Số dư (quy đổi KRW)',          'financial', 'number', '재정보증 금액', NULL, false, true, 111),
('bank_account_no',       '계좌 번호',          'Số tài khoản',                 'financial', 'text',   '뒷자리 4자리만도 가능', NULL, false, false, 112),
('financial_proof_issued','잔고증명서 발급일',  'Ngày cấp giấy chứng minh tài chính', 'financial', 'date', NULL, NULL, false, false, 113),

-- 어학
('topik_level',           'TOPIK 등급',         'Cấp độ TOPIK',                 'language', 'select', '1~6급', '1-6', false, false, 120),
('topik_score',           'TOPIK 점수',         'Điểm TOPIK',                   'language', 'number', NULL, NULL, false, false, 121),
('topik_test_date',       'TOPIK 응시일',       'Ngày thi TOPIK',               'language', 'date',   NULL, NULL, false, false, 122),
('korean_alt_method',     '한국어 대체 인증',   'Chứng nhận tiếng Hàn khác',    'language', 'text',   '예: 세종학당 4급, KIIP 4단계', NULL, false, false, 125),
('english_test_type',     '영어 시험 종류',     'Loại kỳ thi tiếng Anh',        'language', 'text',   '예: TOEFL iBT, IELTS', NULL, false, false, 130),
('english_test_score',    '영어 시험 점수',     'Điểm tiếng Anh',               'language', 'text',   NULL, NULL, false, false, 131),

-- 연락처
('student_phone',     '학생 전화번호',  'Số điện thoại (sinh viên)', 'contact', 'text',   '국가코드 포함', 'Bao gồm mã quốc gia', false, true, 140),
('student_email',     '학생 이메일',    'Email (sinh viên)',         'contact', 'text',   NULL, NULL, false, true, 141),
('student_kakao',     '카카오톡 ID',    'KakaoTalk ID',              'contact', 'text',   '있을 경우', 'Nếu có', false, false, 142),
('student_zalo',      'Zalo ID',        'Zalo ID',                   'contact', 'text',   NULL, NULL, false, false, 143),

-- 경력·자격
('work_experience',     '근무·실습 경력',   'Kinh nghiệm làm việc/thực tập', 'career', 'long_text', '회사·기간·역할 나열', NULL, false, false, 150),
('certifications',      '자격증',           'Chứng chỉ',                     'career', 'long_text', '한국어/관련 분야', NULL, false, false, 151),

-- 서술형 (작문 기초 데이터) ★★ 핵심 ★★
('essay_motivation_korea',    '한국 유학 결심 계기',     'Lý do quyết định du học Hàn Quốc', 'essay', 'long_text',
  '한국의 어떤 점이 매력적인지, 어떤 경험·매체·사람의 영향이 있었는지, 실제 사례가 있다면 구체적으로. 자유롭게 작성하면 AI 가 양식별 질문에 맞게 작문해줍니다.',
  'Điểm nào của Hàn Quốc hấp dẫn, ảnh hưởng từ trải nghiệm/phương tiện/người nào, ví dụ cụ thể nếu có. Viết tự do — AI sẽ soạn theo từng câu hỏi của trường.',
  true, false, 200),
('essay_major_motivation',    '학과 선택 이유 기초',     'Lý do chọn ngành (cơ sở)',        'essay', 'long_text',
  '이 학과에 끌리는 이유, 관련 경험·관심사, 진로 연관성. 양식의 "왜 이 학과인가" 질문 답변용 기초.',
  'Lý do quan tâm ngành, kinh nghiệm/sở thích liên quan, gắn với nghề nghiệp. Dùng làm cơ sở cho câu hỏi "Tại sao chọn ngành này".',
  true, false, 201),
('essay_study_plan_basis',    '학업 계획 기초',          'Kế hoạch học tập (cơ sở)',        'essay', 'long_text',
  '입학 후 학기별로 무엇을 배우고 어떤 역량을 키우고 싶은지. 동아리·언어·전공 심화 계획 등.',
  'Sau khi nhập học muốn học gì và phát triển năng lực nào theo từng học kỳ. Câu lạc bộ, ngôn ngữ, chuyên môn...',
  true, false, 202),
('essay_career_plan',         '졸업 후 진로 계획',       'Kế hoạch sau tốt nghiệp',         'essay', 'long_text',
  '한국 또는 베트남에서 어떤 일을 하고 싶은지, 왜 그 진로인지, 양 국가 간 어떤 다리 역할을 하고 싶은지.',
  'Muốn làm gì ở Hàn hay Việt sau tốt nghiệp, vì sao, vai trò cầu nối giữa hai nước.',
  true, false, 203),
('essay_self_intro',          '자기 소개 기초',          'Tự giới thiệu (cơ sở)',           'essay', 'long_text',
  '성격, 강점·약점, 가치관, 인생 모토. 가족·성장 환경이 본인에게 끼친 영향.',
  'Tính cách, ưu/nhược điểm, giá trị quan, châm ngôn sống. Ảnh hưởng của gia đình/môi trường.',
  true, false, 204),
('essay_korea_culture_exp',   '한국 문화·언어 경험',     'Trải nghiệm văn hóa/ngôn ngữ Hàn', 'essay', 'long_text',
  '한국어 학습 기간·계기·방법. 한국 음악·드라마·음식·여행 등 경험. 한국인과의 교류 경험.',
  'Thời gian/lý do/cách học tiếng Hàn. Trải nghiệm K-pop, phim, ẩm thực, du lịch. Giao lưu với người Hàn.',
  true, false, 205),
('essay_strengths_weakness',  '본인 강점·약점',          'Ưu điểm và nhược điểm',           'essay', 'long_text',
  '구체적인 예시와 함께. 약점은 극복 노력 포함.',
  'Kèm ví dụ cụ thể. Nhược điểm nên có nỗ lực khắc phục.',
  true, false, 206),
('essay_special_experience',  '특별한 경험·성취',        'Trải nghiệm/thành tích đặc biệt', 'essay', 'long_text',
  '대회 수상, 봉사, 리더십, 도전 등. 양식의 "특별활동" 질문용.',
  'Giải thưởng, tình nguyện, lãnh đạo, thử thách. Cho câu "Hoạt động đặc biệt".',
  true, false, 207),

-- 첨부 파일 (참고용 — 학생이 업로드해야 함)
('document_photo',            '증명사진',           'Ảnh thẻ',                        'document', 'file', '여권 규격, JPG/PNG', NULL, false, true, 300),
('document_passport_copy',    '여권 사본',          'Bản sao hộ chiếu',               'document', 'file', NULL, NULL, false, true, 301),
('document_birth_cert',       '출생증명서',         'Giấy khai sinh',                 'document', 'file', NULL, NULL, false, false, 302),
('document_family_cert',      '가족관계증명서',     'Giấy chứng nhận quan hệ gia đình', 'document', 'file', NULL, NULL, false, false, 303),
('document_highschool_diploma','고등학교 졸업증명서','Bằng tốt nghiệp cấp 3',          'document', 'file', NULL, NULL, false, true, 304),
('document_highschool_transcript','고등학교 성적증명서','Bảng điểm cấp 3',             'document', 'file', NULL, NULL, false, true, 305),
('document_bank_balance',     '잔고증명서',         'Giấy chứng nhận số dư',          'document', 'file', NULL, NULL, false, true, 306),
('document_topik_cert',       'TOPIK 성적표',       'Chứng chỉ TOPIK',                'document', 'file', NULL, NULL, false, false, 307)
ON CONFLICT (key) DO NOTHING;

-- gender select options 채우기
UPDATE study_student_data_types
SET options = '[{"value":"male","label_ko":"남성","label_vi":"Nam"},{"value":"female","label_ko":"여성","label_vi":"Nữ"},{"value":"other","label_ko":"기타","label_vi":"Khác"}]'::jsonb
WHERE key = 'gender';

UPDATE study_student_data_types
SET options = '[{"value":"10","label_ko":"10점 만점","label_vi":"Thang 10"},{"value":"4.5","label_ko":"4.5점 만점","label_vi":"Thang 4.5"},{"value":"4.0","label_ko":"4.0점 만점","label_vi":"Thang 4.0"},{"value":"100","label_ko":"100점 만점","label_vi":"Thang 100"}]'::jsonb
WHERE key = 'highschool_gpa_scale';

UPDATE study_student_data_types
SET options = '[{"value":"1","label_ko":"1급","label_vi":"Cấp 1"},{"value":"2","label_ko":"2급","label_vi":"Cấp 2"},{"value":"3","label_ko":"3급","label_vi":"Cấp 3"},{"value":"4","label_ko":"4급","label_vi":"Cấp 4"},{"value":"5","label_ko":"5급","label_vi":"Cấp 5"},{"value":"6","label_ko":"6급","label_vi":"Cấp 6"}]'::jsonb
WHERE key = 'topik_level';
