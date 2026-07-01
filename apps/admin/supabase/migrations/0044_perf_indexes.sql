-- =============================================================================
-- 0044: 성능 인덱스 (유학센터 포털 + 어드민 대학/유학 페이지 체감 개선)
--
-- 원칙: 작은 테이블·이미 있는 인덱스는 건드리지 않고, 자주 필터/정렬하는데
--       인덱스가 없는 '핫' 컬럼만 최소한으로 추가. (Nano 티어 write 비용 고려)
-- 모두 멱등(if not exists). 테이블이 작아 CREATE INDEX 잠금은 사실상 즉시.
-- =============================================================================

-- study_applications: 모든 학생 상세(개요/서류등록/정보입력/최종서류)가 student_id 로 조회.
-- 인덱스 전무 → 학생마다 풀스캔. 가장 효과 큰 항목.
create index if not exists study_applications_student_idx
  on public.study_applications(student_id);

-- study_managed_students: 학생 목록 정렬·필터. 인덱스 전무.
--   center 포털: RLS 로 org_id 필터 후 created_at 최신순  → 복합
create index if not exists study_managed_students_org_created_idx
  on public.study_managed_students(org_id, created_at desc);
--   admin 유학생 목록: 전체 created_at 최신순
create index if not exists study_managed_students_created_idx
  on public.study_managed_students(created_at desc);

-- study_offerings: 모집 목록(admin·center)·대학별 모집. 인덱스 전무.
create index if not exists study_offerings_status_created_idx
  on public.study_offerings(status, created_at desc);
create index if not exists study_offerings_university_status_idx
  on public.study_offerings(university_id, status);

-- 참고(추가 안 함): universities·departments·study_centers 등은 행 수가 적어
--   기존 active 인덱스로 충분. study_admission_specs / form_files / essay_drafts /
--   submission_files(unique) / final_docs 는 이미 적절한 인덱스 보유.
