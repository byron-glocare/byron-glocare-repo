-- =============================================================================
-- 0031: "동일(same)" 연결성 제거 — 별칭으로 통합
--
-- 운영자 결정(2026-06-18): 별칭(aliases)과 연결성-동일(same)이 사실상 같은 개념.
--   별칭 = 외부 서류 라벨 텍스트 → 표준키 매칭.
--   동일 = 중복 키끼리 값 공유(우회책).
-- → 같은 개념은 키 하나로 합치고, 변형 이름은 전부 별칭에 넣는다. 동일 제거.
--   (값 공유는 "키 하나 + 좌표 여러 개"로 이미 해결되므로 동일 불필요.)
--
-- 처리(전부 link_type='same' 행 전체 대상, 키 하드코딩 X):
--   1) 멤버의 라벨(한/베)·별칭을 대표키(same_as_key) 별칭에 합침.
--   2) 양식/제출서류의 required_data_type_keys 에서 멤버키 → 대표키로 치환·중복제거.
--   3) 학생 값(data_values)을 대표키로 이관(대표 값 없을 때), 나머지 중복은 삭제.
--   4) 멤버 행 완전 삭제.
--   5) link_type 체크를 (independent, reference)로 축소, same_as_key 컬럼 제거.
--
-- ⚠️ 멤버 키를 실제로 삭제한다(운영자 '완전 삭제' 선택). 운영 SQL 에디터에 실행.
-- =============================================================================

begin;

-- 1) 멤버 라벨·별칭 → 대표키 별칭 합침 (대표키별 집계 후 distinct) -----------
with add as (
  select s.same_as_key as ckey, array_agg(s.x) as names
  from (
    select same_as_key,
           unnest(array[label_ko, label_vi] || coalesce(aliases, '{}')) as x
    from public.study_student_data_types
    where link_type = 'same' and same_as_key is not null
  ) s
  where s.x is not null and s.x <> ''
  group by s.same_as_key
)
update public.study_student_data_types c
set aliases = (
  select array(
    select distinct e
    from unnest(coalesce(c.aliases, '{}') || add.names) e
    where e is not null and e <> ''
  )
)
from add
where add.ckey = c.key;

-- 2) 양식 required_data_type_keys: 멤버키 → 대표키 치환 + 중복제거 -----------
update public.study_admission_form_files f
set required_data_type_keys = (
  select array(
    select distinct coalesce(m.same_as_key, k)
    from unnest(f.required_data_type_keys) k
    left join public.study_student_data_types m
      on m.key = k and m.link_type = 'same'
  )
)
where exists (
  select 1 from unnest(f.required_data_type_keys) k
  join public.study_student_data_types m
    on m.key = k and m.link_type = 'same'
);

-- 2b) 제출서류 required_data_type_keys 동일 처리 -----------------------------
update public.study_required_submissions s
set required_data_type_keys = (
  select array(
    select distinct coalesce(m.same_as_key, k)
    from unnest(s.required_data_type_keys) k
    left join public.study_student_data_types m
      on m.key = k and m.link_type = 'same'
  )
)
where exists (
  select 1 from unnest(s.required_data_type_keys) k
  join public.study_student_data_types m
    on m.key = k and m.link_type = 'same'
);

-- 3) 학생 값 이관: 대표키에 값이 없으면 멤버값을 대표키로 -----------------
update public.study_student_data_values v
set data_type_key = m.same_as_key
from public.study_student_data_types m
where v.data_type_key = m.key
  and m.link_type = 'same'
  and not exists (
    select 1 from public.study_student_data_values v2
    where v2.student_id = v.student_id
      and v2.data_type_key = m.same_as_key
  );

-- 3b) 남은 멤버 값(대표키에 이미 값 있던 중복) 삭제 -------------------------
delete from public.study_student_data_values v
using public.study_student_data_types m
where v.data_type_key = m.key and m.link_type = 'same';

-- 4) 멤버 행 삭제 -----------------------------------------------------------
delete from public.study_student_data_types where link_type = 'same';

-- 5) 스키마 축소: link_type = (independent | reference), same_as_key 제거 ----
update public.study_student_data_types set link_type = 'independent'
  where link_type not in ('independent', 'reference');

alter table public.study_student_data_types
  drop constraint if exists study_student_data_types_link_type_chk;
alter table public.study_student_data_types
  add constraint study_student_data_types_link_type_chk
  check (link_type in ('independent', 'reference'));

alter table public.study_student_data_types drop column if exists same_as_key;

commit;
