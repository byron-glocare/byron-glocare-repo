-- =============================================================================
-- 0030: 표준데이터 연결성(linkage) 속성 추가 + 값 일괄 부여
--
-- 운영자 지시(2026-06-18): 모든 표준데이터(study_student_data_types)는
--   ① 연결성(link_type): independent(독립) | same(동일) | reference(참조)
--   ② 타입(input_type/options): 기존 컬럼 그대로 1급 속성
-- 를 속성으로 가진다.
--
--   - independent: 단독 값 (대부분).
--   - same: 개념상 같은 값. 대표키(same_as_key) 1곳에만 입력, 멤버는 read-through.
--   - reference: 사용자 선택(selector)에 따라 다른 데이터에서 가져옴.
--               → 기존 is_derived + derived_from{selector,map} 를 그대로 재사용.
--                 (link_type='reference' ⟺ is_derived=true)
--
-- 멱등(idempotent). 운영 DB SQL 에디터에 붙여넣어 실행.
-- 기존 데이터 파괴 없음(컬럼 추가 + UPDATE 만).
-- =============================================================================

begin;

-- 1) 컬럼 추가 ----------------------------------------------------------------
alter table public.study_student_data_types
  add column if not exists link_type text not null default 'independent';

alter table public.study_student_data_types
  add column if not exists same_as_key text;

-- check 제약 (이미 있으면 무시)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'study_student_data_types_link_type_chk'
  ) then
    alter table public.study_student_data_types
      add constraint study_student_data_types_link_type_chk
      check (link_type in ('independent','same','reference'));
  end if;
end $$;

-- 2) reference 백필: 기존 파생(is_derived) → link_type='reference' ------------
update public.study_student_data_types
  set link_type = 'reference'
  where is_derived = true
    and link_type <> 'reference';

-- 3) same(동일) 그룹 지정 -----------------------------------------------------
-- 외국인등록번호 중복: foreign_registration_no 를 대표로, alien_registration_no 가 동일.
update public.study_student_data_types
  set link_type = 'same', same_as_key = 'foreign_registration_no'
  where key = 'alien_registration_no'
    and exists (select 1 from public.study_student_data_types
                where key = 'foreign_registration_no');

-- 본국 주소 = 베트남 거주 주소(베트남 학생 기준 동일): home_country_address 대표.
update public.study_student_data_types
  set link_type = 'same', same_as_key = 'home_country_address'
  where key = 'residence_addr_vn'
    and exists (select 1 from public.study_student_data_types
                where key = 'home_country_address');

-- 4) 정합성: same 인데 대표키가 비었으면 독립으로 되돌림(안전장치) -----------
update public.study_student_data_types
  set link_type = 'independent', same_as_key = null
  where link_type = 'same' and (same_as_key is null or same_as_key = '');

commit;

-- 확인용(선택 실행):
-- select key, label_ko, link_type, same_as_key, is_derived, derived_from
--   from public.study_student_data_types
--   where link_type <> 'independent' order by link_type, key;
