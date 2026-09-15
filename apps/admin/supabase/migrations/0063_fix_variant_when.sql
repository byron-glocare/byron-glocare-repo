-- =============================================================================
-- 0063: 0062 의 구성 when 보정 실수 바로잡기
--
-- 0062 는 when=null 을 {"nationality":"vn"} 으로 바꾸려 했는데,
--   coalesce(v->'when','{}') || '{"nationality":"vn"}'
-- 에서 v->'when' 이 SQL NULL 이 아니라 **JSON null** 이라 coalesce 가 그대로 통과했고,
-- 'null'::jsonb || '{...}' 는 객체가 아니라 배열 [null, {...}] 이 된다.
-- 그래서 확인 쿼리의 variants_without_nation 이 58 로 남았다.
--
-- 여기서는 jsonb_set 으로 when 을 통째로 다시 쓴다:
--   객체이면 nationality 만 없을 때 채우고, 객체가 아니면(null·배열) {"nationality":"vn"}.
-- 여러 번 돌려도 안전하다.
-- =============================================================================

update public.study_doc_items i
   set variants = (
     select coalesce(jsonb_agg(
       jsonb_set(
         v.value, '{when}',
         case when jsonb_typeof(v.value->'when') = 'object'
              then (v.value->'when')
                   || case when coalesce(v.value->'when'->>'nationality','') = ''
                           then '{"nationality":"vn"}'::jsonb else '{}'::jsonb end
              else '{"nationality":"vn"}'::jsonb end,
         true)
       order by v.ordinality), '[]'::jsonb)
       from jsonb_array_elements(i.variants) with ordinality as v(value, ordinality)
   ),
   updated_at = timezone('utc', now())
 where jsonb_typeof(i.variants) = 'array'
   and exists (
     select 1 from jsonb_array_elements(i.variants) v
      where jsonb_typeof(v->'when') <> 'object' or coalesce(v->'when'->>'nationality','') = ''
   );

-- 확인 — 0 이어야 한다
select
  (select count(*) from public.study_doc_items i, jsonb_array_elements(i.variants) v
    where jsonb_typeof(v->'when') <> 'object' or coalesce(v->'when'->>'nationality','') = '') as variants_without_nation,
  (select count(*) from public.study_doc_items) as items;
