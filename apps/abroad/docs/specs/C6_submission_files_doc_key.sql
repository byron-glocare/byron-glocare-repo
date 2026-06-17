-- =====================================================================
--  C6 — 제출서류 파일을 '모집요강 문서 key' 로도 받기
--
--  배경: abroad 서류 등록 리스트를 admin 이 등록한 study_required_submissions 가
--  아니라 **모집요강(study_admission_specs.required_documents)** 에서 파생하도록 변경.
--  발급서류가 별도 등록되지 않은 대학도 학생이 바로 업로드할 수 있어야 하므로,
--  업로드 대상을 submission_id 뿐 아니라 문서 key(doc_key)로도 식별한다.
--
--  - submission_id NOT NULL 해제 (doc_key 기반이면 null)
--  - doc_key 컬럼 추가
--  - 둘 중 하나는 필수(check)
--  - 학생당 문서 1파일: (student_id, doc_key) 유일
-- =====================================================================

alter table study_student_submission_files
  alter column submission_id drop not null;

alter table study_student_submission_files
  add column if not exists doc_key text;

alter table study_student_submission_files
  drop constraint if exists sssf_target_chk;
alter table study_student_submission_files
  add constraint sssf_target_chk
  check (submission_id is not null or doc_key is not null);

create unique index if not exists sssf_unique_doc_key
  on study_student_submission_files (student_id, doc_key)
  where doc_key is not null;
