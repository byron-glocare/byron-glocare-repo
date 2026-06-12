-- =====================================================================
--  C4 — 학생 지원(application) 단계값 재정의
--
--  운영자 결정: 학생 처리 단계를 아래 7개로.
--    결제 전 / 서류 작성 중 / 서류 작성 완료 / 대학교 제출 완료 / 입학 / 불합격 / 중도 취소
--
--  매핑(기존 → 신규):
--    ready_for_review·reviewing·revisions_required → preparing(서류 작성 중)
--    accepted → enrolled(입학)
--    나머지(preparing/submitted/rejected/cancelled) 유지
--  신규 키: payment_pending(결제 전), docs_complete(서류 작성 완료)
--
--  ⚠ 기존 CHECK(인라인 자동명 study_applications_status_check) 교체 필요.
-- =====================================================================

-- 1. 기존 값 remap (테스트 데이터)
UPDATE study_applications
  SET status = 'preparing'
  WHERE status IN ('ready_for_review', 'reviewing', 'revisions_required');
UPDATE study_applications
  SET status = 'enrolled'
  WHERE status = 'accepted';

-- 2. CHECK 제약 교체
ALTER TABLE study_applications DROP CONSTRAINT IF EXISTS study_applications_status_check;
ALTER TABLE study_applications
  ADD CONSTRAINT study_applications_status_check
  CHECK (status IN (
    'payment_pending',  -- 결제 전
    'preparing',        -- 서류 작성 중
    'docs_complete',    -- 서류 작성 완료
    'submitted',        -- 대학교 제출 완료
    'enrolled',         -- 입학
    'rejected',         -- 불합격
    'cancelled'         -- 중도 취소
  ));

-- 3. 신규 지원 기본값 = 결제 전
ALTER TABLE study_applications ALTER COLUMN status SET DEFAULT 'payment_pending';
