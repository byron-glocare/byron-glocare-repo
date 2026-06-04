-- =====================================================================
-- Plan B / Phase B1 — 데이터베이스 스키마 초안
-- 작성: 2026-05-26
-- 출처: PLAN_B.md §8 (데이터 모델) + Decision Log #3, #9, #10
-- 참조: PLAN_B.md
--
-- 적용 대상: Supabase (PostgreSQL 15+)
-- 인스턴스: glocare_homepage_abroad / glocare_customer_management 공유
--
-- 전제 (기존 테이블, 본 파일에서 수정 X):
--   - universities       : id bigint PK (Supabase generated identity)
--   - departments        : id bigint PK, university_id bigint FK
--   - 기존 auth.users    : Supabase Auth (id uuid)
--
-- 명명 규약:
--   - 신규 도메인 테이블은 모두 `study_` prefix
--   - JSONB 컬럼은 스키마 검증을 application 단에서 (B1 후반에 zod)
--   - 한국어/베트남어 텍스트는 _ko / _vi suffix
-- =====================================================================


-- =====================================================================
-- 0. 공통: 트리거 함수 (updated_at 자동 갱신)
-- =====================================================================
CREATE OR REPLACE FUNCTION study_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================================
-- 1. study_pricing_plans — 가격 모델 (Decision #3)
--    4모델(per_student / monthly / percentage / hybrid) 모두 표현 가능한
--    유연 스키마. 내부 어드민에서 유학센터별로 plan 을 생성·할당.
-- =====================================================================
CREATE TABLE study_pricing_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,                       -- e.g. "Standard 2026 Spring"
  model           text NOT NULL CHECK (model IN ('per_student','monthly','percentage','hybrid')),
  currency        text NOT NULL DEFAULT 'KRW',         -- ISO 4217

  -- model 별 파라미터 (해당 model 에서만 사용, 나머지는 null)
  per_student_fee     numeric(12,2),                   -- per_student / hybrid 기본료
  monthly_fee         numeric(12,2),                   -- monthly / hybrid
  percentage_rate     numeric(5,4),                    -- percentage / hybrid  (0.0500 = 5%)
  percentage_basis    text CHECK (percentage_basis IN ('tuition','total_paid')),  -- % 기준
  hybrid_params       jsonb,                           -- hybrid 추가 세부 (e.g. {tier_thresholds:[...]} )

  -- 메타
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  effective_from  date,
  effective_to    date,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT pricing_per_student_required CHECK (
    model <> 'per_student' OR per_student_fee IS NOT NULL
  ),
  CONSTRAINT pricing_monthly_required CHECK (
    model <> 'monthly' OR monthly_fee IS NOT NULL
  ),
  CONSTRAINT pricing_percentage_required CHECK (
    model <> 'percentage' OR (percentage_rate IS NOT NULL AND percentage_basis IS NOT NULL)
  )
);

CREATE TRIGGER trg_study_pricing_plans_updated
  BEFORE UPDATE ON study_pricing_plans
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 2. study_center_orgs — 유학센터 회사
-- =====================================================================
CREATE TABLE study_center_orgs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_vi              text NOT NULL,
  name_ko              text,
  country              text NOT NULL DEFAULT 'VN',     -- ISO 3166-1 alpha-2
  tax_id               text,                            -- 베트남 MST 또는 한국 사업자번호
  status               text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','active','suspended','closed')),

  pricing_plan_id      uuid REFERENCES study_pricing_plans(id) ON DELETE SET NULL,
  settlement_currency  text NOT NULL DEFAULT 'KRW',

  contact_info         jsonb,                           -- {address, phone, email, website, primary_contact_name}

  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW(),
  activated_at         timestamptz,
  deactivated_at       timestamptz
);

CREATE INDEX idx_study_center_orgs_status ON study_center_orgs(status) WHERE status = 'active';
CREATE TRIGGER trg_study_center_orgs_updated
  BEFORE UPDATE ON study_center_orgs
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 3. study_center_users — 유학센터 담당자 (1 org : N user)
--    auth.users 와 매핑. RLS 의 핵심.
-- =====================================================================
CREATE TABLE study_center_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES study_center_orgs(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  name         text NOT NULL,
  role         text NOT NULL DEFAULT 'user'
               CHECK (role IN ('admin','user')),       -- org 내부 권한
  status       text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','suspended')),
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_center_users_org ON study_center_users(org_id);
CREATE INDEX idx_study_center_users_auth ON study_center_users(auth_user_id);
CREATE TRIGGER trg_study_center_users_updated
  BEFORE UPDATE ON study_center_users
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 4. study_managed_students — 유학센터가 등록한 학생 (시스템 접근 X)
-- =====================================================================
CREATE TABLE study_managed_students (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES study_center_orgs(id) ON DELETE RESTRICT,
  name                     text NOT NULL,
  dob                      date,
  passport_no_encrypted    text,                       -- pgcrypto 또는 application 단 암호화
  phone                    text,
  email                    text,                       -- 학생 본인 — 알림용 비활성 (Decision #7)
  topik_level              text,                       -- '1'..'6' or null
  current_visa             text CHECK (current_visa IN ('D-4','D-2','none','other') OR current_visa IS NULL),
  location                 text CHECK (location IN ('VN','KR','other') OR location IS NULL),
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT NOW(),
  updated_at               timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_managed_students_org ON study_managed_students(org_id);
CREATE TRIGGER trg_study_managed_students_updated
  BEFORE UPDATE ON study_managed_students
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 5. study_admission_specs — 모집요강 전산화 (핵심 자산)
--    Decision #10: 학기별 (Spring/Fall) 갱신 → term 컬럼
--    PoC step3 lock (2026-05-26): 5 JSONB + departments + metadata 구조.
--    상세 sub-스키마는 src/lib/admission/spec-schema.ts (zod).
--    multi-department: row 1건 + departments[] JSONB.
--    Unique = (university_id, term, admission_category) — NULLS NOT DISTINCT (PG15+)
-- =====================================================================
CREATE TABLE study_admission_specs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id         bigint NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
  term                  text NOT NULL,                  -- e.g. '2026-Spring', '2026-Fall', '2026-Year'
  admission_category    text,                            -- '순수외국인 특별전형' / '글로벌요양복지과' / null
  program_type          text NOT NULL DEFAULT 'bachelor_4yr'
                        CHECK (program_type IN (
                          'language_program',
                          'associate_2yr',
                          'bachelor_3yr_extension',
                          'bachelor_4yr'
                        )),

  -- 학과 정보 — 모집요강 1건 ↔ N 학과 (대구예술 11학과, 유한 36+학과 등)
  --   각 항목 = { faculty, name, track, years, korean_min_topik, tuition_per_semester_krw, is_glocare_target, ... }
  departments           jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- PoC step3 lock 의 5 JSONB 영역 (PLAN_B §8.2 유지)
  required_documents    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 서류 리스트
  eligibility           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- 자격·한국어·재정·배제 조건
  schedule              jsonb NOT NULL DEFAULT '{}'::jsonb,   -- rounds[] + academic_calendar + semester_start
  tuition               jsonb NOT NULL DEFAULT '{}'::jsonb,   -- unit·disclosure_state·by_faculty·refund_policy
  scholarships          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- 장학금 + tiered_by_topik + exclusivity_with

  -- 신규: 5 카테고리 밖 통합 메타데이터
  --   selection_process / post_acceptance / living_cost / forms / contacts /
  --   government_designations / country_specific_notes_vi / language_program / extra
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- AI 추출 / 검수 메타
  source_file_url       text,                           -- 원본 PDF/HWP
  ai_extraction_log     jsonb,                          -- 추출 모델·프롬프트·신뢰도
  approved_by           uuid REFERENCES auth.users(id),
  approved_at           timestamptz,

  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','reviewing','approved','archived')),

  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT study_admission_specs_unique_spec
    UNIQUE NULLS NOT DISTINCT (university_id, term, admission_category)
);

-- 검색·필터 인덱스
CREATE INDEX idx_study_admission_specs_program
  ON study_admission_specs(program_type, status)
  WHERE status = 'approved';

CREATE INDEX idx_study_admission_specs_term
  ON study_admission_specs(term, status)
  WHERE status = 'approved';

CREATE INDEX idx_study_admission_specs_university
  ON study_admission_specs(university_id, status)
  WHERE status = 'approved';

-- departments[] 내부 학과명·계열 검색용 GIN
CREATE INDEX idx_study_admission_specs_departments_gin
  ON study_admission_specs USING GIN (departments jsonb_path_ops);

-- 정부 지정 학교 빠른 필터 (metadata.government_designations)
CREATE INDEX idx_study_admission_specs_gov_designations
  ON study_admission_specs USING GIN ((metadata -> 'government_designations'));

CREATE TRIGGER trg_study_admission_specs_updated
  BEFORE UPDATE ON study_admission_specs
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 6. study_applications — 학생 지원 (1 학생 : N 지원)
--    학과: spec.departments[] 가 다수일 수 있으므로 학생 지원 시 특정 학과를 명시.
--    target_department_id 가 우선, FK 매칭 불가 시 target_department_label 자유 텍스트.
-- =====================================================================
CREATE TABLE study_applications (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                  uuid NOT NULL REFERENCES study_managed_students(id) ON DELETE CASCADE,
  admission_spec_id           uuid NOT NULL REFERENCES study_admission_specs(id) ON DELETE RESTRICT,

  -- 학생이 지원한 특정 학과 (spec.departments[] 중 1개)
  target_department_id        bigint REFERENCES departments(id) ON DELETE SET NULL,
  target_department_label     text,                     -- FK 매칭 실패 시 (예: '국제관광경영학과' 자유텍스트)

  status                      text NOT NULL DEFAULT 'preparing'
                              CHECK (status IN (
                                'preparing','ready_for_review','reviewing','revisions_required',
                                'submitted','accepted','rejected','enrolled','cancelled'
                              )),

  next_action                 text,                     -- '추천서 수령', '면접 일정 확정' 등 (자유 텍스트)
  next_deadline               date,

  created_at                  timestamptz NOT NULL DEFAULT NOW(),
  updated_at                  timestamptz NOT NULL DEFAULT NOW(),
  last_review_at              timestamptz,
  submitted_to_university_at  timestamptz,
  accepted_at                 timestamptz,
  enrolled_at                 timestamptz,
  cancelled_at                timestamptz
);

CREATE INDEX idx_study_applications_student ON study_applications(student_id);
CREATE INDEX idx_study_applications_spec ON study_applications(admission_spec_id);
CREATE INDEX idx_study_applications_status ON study_applications(status) WHERE status NOT IN ('enrolled','cancelled','rejected');
CREATE TRIGGER trg_study_applications_updated
  BEFORE UPDATE ON study_applications
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 7. study_application_documents — 학생이 제출한 서류
-- =====================================================================
CREATE TABLE study_application_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        uuid NOT NULL REFERENCES study_applications(id) ON DELETE CASCADE,
  document_type         text NOT NULL,                  -- 모집요강 required_documents 의 key
  file_url              text NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','ai_done','human_review','approved','rejected')),

  ai_review_result      jsonb,
  ai_reviewed_at        timestamptz,

  human_review_result   text,
  human_reviewer_id     uuid REFERENCES auth.users(id),
  human_reviewed_at     timestamptz,

  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_application_documents_app ON study_application_documents(application_id);
CREATE INDEX idx_study_application_documents_status ON study_application_documents(status) WHERE status IN ('pending','ai_done','human_review');
CREATE TRIGGER trg_study_application_documents_updated
  BEFORE UPDATE ON study_application_documents
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 8. study_review_feedback — 검토 피드백 히스토리
-- =====================================================================
CREATE TABLE study_review_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES study_application_documents(id) ON DELETE CASCADE,
  reviewer_type   text NOT NULL CHECK (reviewer_type IN ('ai','human')),
  reviewer_id     uuid REFERENCES auth.users(id),       -- ai 면 null
  content_vi      text,
  content_ko      text,
  severity        text NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','warning','error')),
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  resolved_at     timestamptz
);

CREATE INDEX idx_study_review_feedback_doc ON study_review_feedback(document_id);


-- =====================================================================
-- 9. study_timelines — 학생별 D-day (자동 생성, 모집요강 schedule 기반)
-- =====================================================================
CREATE TABLE study_timelines (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id         uuid NOT NULL REFERENCES study_applications(id) ON DELETE CASCADE,
  event_type             text NOT NULL,                  -- 'application_open','application_close','interview','result','enrollment' 등
  event_date             date NOT NULL,
  source_spec_field      text,                           -- e.g. 'schedule.application_close'
  notification_sent_at   timestamptz,
  created_at             timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_timelines_upcoming ON study_timelines(event_date)
  WHERE notification_sent_at IS NULL;


-- =====================================================================
-- 10. study_invoices — 인보이스 (B2B)
-- =====================================================================
CREATE TABLE study_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES study_center_orgs(id) ON DELETE RESTRICT,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  line_items        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{student_id, application_id, description, qty, unit_price, amount}]
  total_amount      numeric(14,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'KRW',
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','paid','cancelled')),
  tax_invoice_url   text,                                -- 세금계산서 PDF
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),
  sent_at           timestamptz,
  paid_at           timestamptz
);

CREATE INDEX idx_study_invoices_org ON study_invoices(org_id);
CREATE INDEX idx_study_invoices_status ON study_invoices(status) WHERE status IN ('draft','sent');
CREATE TRIGGER trg_study_invoices_updated
  BEFORE UPDATE ON study_invoices
  FOR EACH ROW EXECUTE FUNCTION study_touch_updated_at();


-- =====================================================================
-- 11. study_settlements — 송금 매칭
-- =====================================================================
CREATE TABLE study_settlements (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           uuid NOT NULL REFERENCES study_invoices(id) ON DELETE RESTRICT,
  amount               numeric(14,2) NOT NULL,
  currency             text NOT NULL DEFAULT 'KRW',
  received_at          timestamptz NOT NULL,
  bank_reference       text,                             -- 입금자명 / 거래번호
  attached_proof_url   text,                             -- 송금 증빙
  matched_by_admin     uuid REFERENCES auth.users(id),
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_study_settlements_invoice ON study_settlements(invoice_id);


-- =====================================================================
-- RLS — Row Level Security
-- 핵심: 유학센터 사용자는 자기 org_id 의 데이터만, 글로케어 관리자는 전체.
-- 글로케어 관리자 식별: auth.users.raw_app_meta_data->>'role' = 'glocare_admin'
--   (Supabase Auth 의 app_metadata 에 role 을 세팅. Auth UI 가 아닌 service_role 로만 변경 가능)
-- =====================================================================

-- 보조 함수: 현재 사용자가 글로케어 관리자인지
CREATE OR REPLACE FUNCTION study_is_glocare_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin',
    false
  );
$$ LANGUAGE sql STABLE;

-- 보조 함수: 현재 사용자의 유학센터 org_id 들 (보통 1개)
CREATE OR REPLACE FUNCTION study_my_org_ids()
RETURNS SETOF uuid AS $$
  SELECT org_id FROM study_center_users
  WHERE auth_user_id = auth.uid() AND status = 'active';
$$ LANGUAGE sql STABLE;


-- ---- study_center_orgs ----
ALTER TABLE study_center_orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY orgs_admin_all ON study_center_orgs
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY orgs_member_read ON study_center_orgs
  FOR SELECT TO authenticated
  USING (id IN (SELECT study_my_org_ids()));


-- ---- study_center_users ----
ALTER TABLE study_center_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_admin_all ON study_center_users
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY users_self_read ON study_center_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR org_id IN (SELECT study_my_org_ids()));


-- ---- study_managed_students ----
ALTER TABLE study_managed_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY students_admin_all ON study_managed_students
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY students_org_member_all ON study_managed_students
  FOR ALL TO authenticated
  USING (org_id IN (SELECT study_my_org_ids()))
  WITH CHECK (org_id IN (SELECT study_my_org_ids()));


-- ---- study_admission_specs ----
-- 모집요강은 공용 자산 — 모든 인증 사용자가 approved 만 읽기 가능, 쓰기는 관리자
ALTER TABLE study_admission_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY specs_admin_all ON study_admission_specs
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY specs_read_approved ON study_admission_specs
  FOR SELECT TO authenticated
  USING (status = 'approved');


-- ---- study_applications ----
ALTER TABLE study_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY apps_admin_all ON study_applications
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY apps_org_member_all ON study_applications
  FOR ALL TO authenticated
  USING (student_id IN (
    SELECT id FROM study_managed_students WHERE org_id IN (SELECT study_my_org_ids())
  ))
  WITH CHECK (student_id IN (
    SELECT id FROM study_managed_students WHERE org_id IN (SELECT study_my_org_ids())
  ));


-- ---- study_application_documents ----
ALTER TABLE study_application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY docs_admin_all ON study_application_documents
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY docs_org_member_all ON study_application_documents
  FOR ALL TO authenticated
  USING (application_id IN (
    SELECT a.id FROM study_applications a
    JOIN study_managed_students s ON s.id = a.student_id
    WHERE s.org_id IN (SELECT study_my_org_ids())
  ))
  WITH CHECK (application_id IN (
    SELECT a.id FROM study_applications a
    JOIN study_managed_students s ON s.id = a.student_id
    WHERE s.org_id IN (SELECT study_my_org_ids())
  ));


-- ---- study_review_feedback ----
ALTER TABLE study_review_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_admin_all ON study_review_feedback
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY feedback_org_member_read ON study_review_feedback
  FOR SELECT TO authenticated
  USING (document_id IN (
    SELECT d.id FROM study_application_documents d
    JOIN study_applications a ON a.id = d.application_id
    JOIN study_managed_students s ON s.id = a.student_id
    WHERE s.org_id IN (SELECT study_my_org_ids())
  ));


-- ---- study_timelines ----
ALTER TABLE study_timelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY timelines_admin_all ON study_timelines
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY timelines_org_member_read ON study_timelines
  FOR SELECT TO authenticated
  USING (application_id IN (
    SELECT a.id FROM study_applications a
    JOIN study_managed_students s ON s.id = a.student_id
    WHERE s.org_id IN (SELECT study_my_org_ids())
  ));


-- ---- study_invoices ----
ALTER TABLE study_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_admin_all ON study_invoices
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY invoices_org_member_read ON study_invoices
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT study_my_org_ids()));


-- ---- study_settlements ----
ALTER TABLE study_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlements_admin_all ON study_settlements
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());

CREATE POLICY settlements_org_member_read ON study_settlements
  FOR SELECT TO authenticated
  USING (invoice_id IN (
    SELECT id FROM study_invoices WHERE org_id IN (SELECT study_my_org_ids())
  ));


-- ---- study_pricing_plans ----
-- 가격 plan 은 내부 어드민만 보고/수정 (유학센터에 노출 X)
ALTER TABLE study_pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_admin_all ON study_pricing_plans
  FOR ALL TO authenticated
  USING (study_is_glocare_admin())
  WITH CHECK (study_is_glocare_admin());


-- =====================================================================
-- 적용 노트
-- 1) 본 SQL 은 Supabase Studio SQL Editor 에서 검토·실행 예정.
-- 2) 실행 전 백업: glocare_homepage_abroad 와 glocare_customer_management
--    가 같은 인스턴스를 공유하므로 영향 범위 큰 변경. 스냅샷 권장.
-- 3) 글로케어 관리자 role 부여 절차:
--      UPDATE auth.users
--      SET raw_app_meta_data = jsonb_set(
--        COALESCE(raw_app_meta_data,'{}'::jsonb), '{role}', '"glocare_admin"'
--      )
--      WHERE email = '<admin-email>';
--    (service_role 키로만 실행)
-- 4) JSONB 컬럼(required_documents, eligibility, schedule, tuition, scholarships,
--    departments, metadata, ai_extraction_log, contact_info, hybrid_params,
--    line_items, ai_review_result)
--    의 내부 스키마는 application 단(zod) 에서 검증.
--    `study_admission_specs` 의 spec_data 7 JSONB → src/lib/admission/spec-schema.ts (B1-4 PoC step3 lock).
-- 5) PostgreSQL 15+ 필요. UNIQUE NULLS NOT DISTINCT 사용 (admission_category=NULL 행 중복 방지).
--    Supabase 는 2026-05 시점 기본 PG15+ 이므로 호환.
-- =====================================================================
