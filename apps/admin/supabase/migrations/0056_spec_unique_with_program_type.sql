-- 0056: 모집요강 유일키에 program_type 추가
--
-- 배경:
--   한 대학·한 학기에 **어학연수(D-4) 요강**과 **학위과정 요강**이 동시에 있어야 한다.
--   (학생 경로: 어학당 → / 한국 어학당 재학 중 D-2 지원 / 해외에서 바로 D-2 지원.
--    뒤 둘은 같은 학위 요강을 쓰고 제출서류만 거주지로 갈린다 —
--    study_required_submissions.applies_to_locations 가 이미 처리.)
--
--   그런데 기존 유일키가 (university_id, term, admission_category) 라서,
--   두 요강 모두 admission_category 가 비어 있으면 두 번째 insert 가 거부됐다.
--   program_type 은 이미 과정을 구분하는 enum('language_program' 등)이므로 키에 넣는다.
--
-- 안전:
--   유일키가 **느슨해지는** 방향(컬럼 추가 = 더 많은 조합 허용)이라
--   기존 데이터로 제약 생성이 실패할 수 없다. 되돌리려면 program_type 만 빼고 재생성.
--
-- 운영 확인 결과(2026-08-31): 제약이 아래 이름·정의로 실제 존재함.
--   study_admission_specs_unique_spec
--     UNIQUE NULLS NOT DISTINCT (university_id, term, admission_category)

begin;

alter table public.study_admission_specs
  drop constraint if exists study_admission_specs_unique_spec;

alter table public.study_admission_specs
  add constraint study_admission_specs_unique_spec
    unique nulls not distinct (university_id, term, admission_category, program_type);

commit;

-- 확인용
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.study_admission_specs'::regclass and contype = 'u';
