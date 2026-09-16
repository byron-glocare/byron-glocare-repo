-- =============================================================================
-- 0067d: 0067b 를 두 번 돌려 생긴 가짜 학과 9개 지우기
--
-- 0067b 는 끝에 대표 요강의 departments JSONB 를 (어학당 포함) 캐시로 다시 쓴다.
-- 그 상태에서 0067b 를 다시 돌리면 대표 요강(과정=학위)의 JSONB 에 들어 있는 어학당 항목을
-- 일반학과로 읽어, 이름이 어학 계열이라 매칭에서 빠지고(일반학과 찾기는 어학 이름을 제외)
-- 새 학과 마스터(active=false)와 일반학과 행, draft 모집 행을 만들었다.
-- 2026-09-16 09:44 UTC 에 생긴 것 9개. 서류·양식·지원서는 하나도 붙어 있지 않다(확인함).
--
-- ⚠ 0067b 는 다시 돌리지 않는다. (이 파일은 여러 번 돌려도 같다.)
-- =============================================================================

-- 1. 가짜 학과의 draft 모집 행
delete from public.study_offerings
 where department_id in (74, 75, 76, 77, 78, 79, 80, 81, 82)
   and status = 'draft';

-- 2. 가짜 일반학과 행 (어학 계열 이름인데 kind=regular)
delete from public.study_spec_departments sd
 using public.departments dp
 where dp.id = sd.department_id
   and sd.kind = 'regular'
   and sd.department_id in (74, 75, 76, 77, 78, 79, 80, 81, 82)
   and dp.name_ko ~ '(어학|한국어|연수)'
   and not exists (select 1 from public.study_spec_doc_items r where r.spec_department_id = sd.id)
   and not exists (select 1 from public.study_admission_form_files f where f.spec_department_id = sd.id);

-- 3. 그때 만들어진 학과 마스터 (아무 데서도 안 쓰는 것만)
delete from public.departments dp
 where dp.id in (74, 75, 76, 77, 78, 79, 80, 81, 82)
   and dp.active = false
   and dp.name_ko ~ '(어학|한국어|연수)'
   and not exists (select 1 from public.study_spec_departments sd where sd.department_id = dp.id)
   and not exists (select 1 from public.study_offerings o where o.department_id = dp.id)
   and not exists (select 1 from public.study_applications a where a.target_department_id = dp.id)
   and not exists (select 1 from public.study_admission_form_files f where dp.id = any(f.applies_to_department_ids));

-- 확인 — spec_departments 23, bogus_regular_language 0, leftover_masters 0
select
  (select count(*) from public.study_spec_departments) as spec_departments,
  (select count(*) from public.study_spec_departments sd join public.departments dp on dp.id = sd.department_id
    where sd.kind = 'regular' and dp.name_ko ~ '(어학|한국어|연수)') as bogus_regular_language,
  (select count(*) from public.departments where id between 74 and 82) as leftover_masters;
