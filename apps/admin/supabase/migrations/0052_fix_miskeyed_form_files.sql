-- 0052: 잘못 분류된 작성서류 양식 복구
--
-- 원인. 모집요강 상세의 [양식 업로드] 링크가 "어느 서류의 양식인지"(key)를
-- 넘기지 않아, 업로드 화면이 양식종류를 '입학 지원서(application_form)'로
-- 기본 선택한 채 저장했다. 그 결과 두 가지가 깨졌다.
--
--   1) 자기소개서 양식을 올려도 key='application_form' 으로 저장돼
--      모집요강 화면에서는 계속 "미등록" 으로 보였다.
--   2) 버전 그룹이 (university_id, key, department_name) 이라서,
--      기존 입학원서 양식이 "구버전"으로 밀려나 현행 양식이 사라졌다.
--
-- 코드는 고쳤다(링크가 key·서류명을 넘기고, 기본 선택을 없앰).
-- 이 마이그레이션은 이미 어긋난 행을 되돌린다.
--
-- 멱등: 이름으로 판별해 key 를 맞추고, 현행이 비어 버린 그룹만 되살린다.

-- ── 1. 이름이 명백한데 key 가 application_form 인 행 정정 ──────────────────
update public.study_admission_form_files
   set key = 'self_intro', updated_at = now()
 where key = 'application_form'
   and name_ko ~ '자기소개';

update public.study_admission_form_files
   set key = 'study_plan', updated_at = now()
 where key = 'application_form'
   and name_ko ~ '(학업|수학)계획'
   and name_ko !~ '자기소개';

update public.study_admission_form_files
   set key = 'privacy_consent', updated_at = now()
 where key = 'application_form'
   and name_ko ~ '개인정보';

update public.study_admission_form_files
   set key = 'financial_pledge_form', updated_at = now()
 where key = 'application_form'
   and name_ko ~ '재정보증';

-- ── 2. 현행 양식이 사라진 그룹 되살리기 ────────────────────────────────────
-- 1번에서 행이 빠져나가면 (대학, 종류, 적용범위) 그룹에 is_current 가
-- 하나도 없는 경우가 생긴다. 그 그룹의 최신 행을 현행으로 되돌린다.
with groups as (
  select university_id, key, coalesce(department_name, '') as scope
    from public.study_admission_form_files
   group by university_id, key, coalesce(department_name, '')
  having count(*) filter (where is_current) = 0
),
newest as (
  select distinct on (f.university_id, f.key, coalesce(f.department_name, ''))
         f.id
    from public.study_admission_form_files f
    join groups g
      on g.university_id = f.university_id
     and g.key = f.key
     and g.scope = coalesce(f.department_name, '')
   order by f.university_id, f.key, coalesce(f.department_name, ''),
            f.created_at desc
)
update public.study_admission_form_files
   set is_current = true, superseded_by = null, updated_at = now()
 where id in (select id from newest);

-- 확인용
-- select university_id, key, department_name, name_ko, is_current, created_at
--   from public.study_admission_form_files
--  where university_id in (11, 15)
--  order by university_id, key, created_at;
