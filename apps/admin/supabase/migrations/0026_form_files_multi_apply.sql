-- 0026: 작성서류 양식(form_files) 복수 적용 — 적용학과/적용학기
--
--   적용: Supabase SQL 에디터에 붙여넣어 실행 (이 프로젝트 표준 워크플로).
--   안전: 컬럼 추가만 — 기존 데이터/노출 영향 없음. 기본값 빈 배열(=전체).
--
--   배경: 입학서류 [작성서류] 상세에서 한 양식파일을 여러 학과·여러 학기에 적용.
--     · applies_to_terms      : 적용 학기 복수. 빈 배열=전체 학기.
--       (어학당=4학기 Spring/Summer/Fall/Winter, 일반학과=봄·가을 2학기 — 운영자가 체크)
--     · applies_to_department_ids : 적용 학과 id 복수. 빈 배열=모든 학과.
--   기존 department_name(단일)은 호환을 위해 보존.

alter table public.study_admission_form_files
  add column if not exists applies_to_terms text[] not null default '{}',
  add column if not exists applies_to_department_ids int[] not null default '{}';

comment on column public.study_admission_form_files.applies_to_terms is '적용 학기 복수(예: {2026-Spring,2026-Fall}). 빈 배열=전체 학기';
comment on column public.study_admission_form_files.applies_to_department_ids is '적용 학과 id 복수. 빈 배열=모든 학과';
