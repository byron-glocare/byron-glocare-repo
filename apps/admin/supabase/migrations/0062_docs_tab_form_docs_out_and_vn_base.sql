-- =============================================================================
-- 0062: 제출서류 탭에서 작성서류 제외 + 구성의 "기본"을 베트남으로
--
-- 운영자 피드백(2026-09-15):
--   · 작성서류(입학원서·자기소개서 등 학교 양식)는 제출서류에서 **삭제**. 작성서류 탭이
--     관리하고, 대학마다 이름·목적이 비슷해도 다른 서류로 취급해도 된다.
--   · "기본 구성"이란 개념은 없다. 나라 단위로 가며 지금은 전부 베트남이니 베트남이 기준.
--
-- 하는 일:
--   1) 새 테이블에서 작성서류 제거 — 서류(is_form_doc), 그 서류 1개짜리 항목, 그 항목의
--      요강↔항목 행. (옛 데이터 탭 study_student_data_types 는 건드리지 않는다 — 분류기가
--      아직 그쪽 is_form_doc 을 읽는다. 0061 이 JSONB 에 넣은 doc_form_* std_key 도 그대로.)
--   2) 구성 when=null → {"nationality":"vn"}. 칸에 required 가 없으면 true.
--
-- ⚠ 0060 을 다시 돌리면 작성서류가 다시 복사된다. 그 뒤 이 파일을 다시 돌리면 된다.
-- =============================================================================

-- 1. 작성서류 제거
delete from public.study_spec_doc_items
 where item_key in (
   select i.key from public.study_doc_items i
   where i.key like 'item_%'
     and exists (select 1 from public.study_doc_standards s
                  where s.is_form_doc and (i.key = 'item_' || s.key or i.key like 'item_' || s.key || '\_\_%'))
 );

delete from public.study_doc_items i
 where exists (select 1 from public.study_doc_standards s
                where s.is_form_doc and (i.key = 'item_' || s.key or i.key like 'item_' || s.key || '\_\_%'));

delete from public.study_doc_standards where is_form_doc;

-- 2. 기본 구성 → 베트남, 칸 required 기본값
update public.study_doc_items i
   set variants = (
     select coalesce(jsonb_agg(
       jsonb_build_object(
         'when',
           case when v.value->'when' is null or jsonb_typeof(v.value->'when') <> 'object'
                     or coalesce(v.value->'when'->>'nationality','') = ''
                then coalesce(v.value->'when', '{}'::jsonb) || '{"nationality":"vn"}'::jsonb
                else v.value->'when' end,
         'slots',
           (select coalesce(jsonb_agg(
              case when s.value ? 'required' then s.value else s.value || '{"required":true}'::jsonb end
              order by s.ordinality), '[]'::jsonb)
              from jsonb_array_elements(coalesce(v.value->'slots','[]'::jsonb)) with ordinality as s(value, ordinality))
       ) order by v.ordinality), '[]'::jsonb)
       from jsonb_array_elements(i.variants) with ordinality as v(value, ordinality)
   ),
   updated_at = timezone('utc', now())
 where jsonb_typeof(i.variants) = 'array';

-- 확인 — form_docs 0, 남은 항목 수, when 없는 구성 0
select
  (select count(*) from public.study_doc_standards where is_form_doc) as form_docs_left,
  (select count(*) from public.study_doc_standards) as standards,
  (select count(*) from public.study_doc_items) as items,
  (select count(*) from public.study_spec_doc_items) as spec_items,
  (select count(*) from public.study_doc_items i, jsonb_array_elements(i.variants) v
    where coalesce(v->'when'->>'nationality','') = '') as variants_without_nation;
