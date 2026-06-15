-- 0027_required_submissions_std_key.sql
-- U2: 발급서류 ↔ 표준 문서 카탈로그 정본 연결 키.
--
--   study_required_submissions 에 std_key 추가.
--   - 표준 문서 카탈로그(study_student_data_types.key, category='document') 의 키를 가리킨다.
--   - 공용 마스터(university_id IS NULL)와 대학별 조정본(base_submission_id 참조)이
--     같은 std_key 를 가지면 "같은 표준 서류"로 간주 → 자동 매칭 / 중복 등록 방지.
--   - 기존 'required_data_type_keys[0]' 로 매핑을 추론하던 불안정한 방식을 대체.
--
--   append-only. 이미 적용된 0024~0026 은 수정하지 않는다.

alter table public.study_required_submissions
  add column if not exists std_key text;

comment on column public.study_required_submissions.std_key is
  '표준 문서 카탈로그(study_student_data_types.key, category=document) 정본 키. 공용↔대학별 발급서류 매칭/중복방지 기준.';

create index if not exists idx_required_submissions_std_key
  on public.study_required_submissions (std_key)
  where std_key is not null;
