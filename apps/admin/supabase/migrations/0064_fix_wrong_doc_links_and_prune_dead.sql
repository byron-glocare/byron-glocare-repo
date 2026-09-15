-- =============================================================================
-- 0064: 잘못 붙은 요강 서류 바로잡기 + 아무도 안 쓰는 죽은 서류·항목 정리
--
-- 검수(2026-09-15, 라이브 DB 읽기)에서 나온 것:
--   1) 출생증명서 5건이 가족관계증명서(document_family_cert)에 붙어 있다.
--      0057 별칭 "가족관계증명서(베트남: 출생증명서 및 호적등본)" 이 출생증명서를 삼켰고,
--      같은 요강에 호적도 같은 서류라 0060 이 출생증명서 줄을 버렸다.
--      → std_key 를 document_birth_cert 로, 요강↔항목 행 item_document_birth_cert 추가.
--   2) 군장대 어학연수 " 부모 신분증" 이 국적증명(dt_9rg10m7)에 붙어 있다.
--      → doc_1mr8dkd(부모 신분증·여권 사본).
--   3) 동남보건대 어학연수의 "부모의 신분증 혹은 여권 사본" → doc_uqbacc, "호적" → doc_11j9l.
--      둘 다 0057 에서 병합돼 비활성된 죽은 서류다.
--      → doc_1mr8dkd, document_family_cert.
--   4) 0060 이 데이터 탭의 비활성 서류 22개까지 그대로 복사해 서류 53 중 22, 항목 58 중 22 가
--      죽은 것이다. 그중 요강·다른 항목·학생 파일 어디서도 안 쓰는 것만 지운다.
--      (학생 파일이 옛 키로 남아 있는 doc_11j9l·doc_jlqza4·doc_16o8gt·doc_noagbl 은 남긴다 —
--       제출서류 탭의 삭제·교체 기능으로 운영자가 처리.)
--
-- 안전:
--   · 바꾸기 전 요강 JSONB 와 지울 행을 _backup_0064_* 에 남긴다.
--   · 이름+옛 std_key 가 둘 다 맞는 줄만 바꾼다. 여러 번 돌려도 같은 결과.
--   · 데이터 탭(study_student_data_types)은 건드리지 않는다.
--   · 같은 스크립트에서 만든 테이블을 뒤 문장이 참조하지 않는다(Supabase 에디터 파싱 순서).
-- =============================================================================

-- 0. 백업
do $do$
begin
  if to_regclass('public._backup_0064_specs') is null then
    execute 'create table public._backup_0064_specs as select id, required_documents from public.study_admission_specs';
  end if;
  if to_regclass('public._backup_0064_spec_doc_items') is null then
    execute 'create table public._backup_0064_spec_doc_items as select * from public.study_spec_doc_items';
  end if;
  if to_regclass('public._backup_0064_doc_standards') is null then
    execute 'create table public._backup_0064_doc_standards as select * from public.study_doc_standards';
  end if;
  if to_regclass('public._backup_0064_doc_items') is null then
    execute 'create table public._backup_0064_doc_items as select * from public.study_doc_items';
  end if;
end
$do$;

-- 1. 요강 JSONB 의 std_key 바로잡기 (이름 + 옛 키가 둘 다 맞을 때만)
update public.study_admission_specs sp
   set required_documents = (
     select jsonb_agg(
              case when f.to_key is not null then x.value || jsonb_build_object('std_key', f.to_key)
                   else x.value end
              order by x.ordinality)
       from jsonb_array_elements(sp.required_documents) with ordinality as x(value, ordinality)
       left join lateral (
         select m.to_key
           from (values
                  ('출생증명서%',                 'document_family_cert', 'document_birth_cert'),
                  ('부모 신분증',                  'dt_9rg10m7',           'doc_1mr8dkd'),
                  ('부모의 신분증 혹은 여권 사본', 'doc_uqbacc',           'doc_1mr8dkd'),
                  ('호적',                         'doc_11j9l',            'document_family_cert')
                ) as m(name_pat, from_key, to_key)
          where trim(x.value->>'name_ko') like m.name_pat
            and x.value->>'std_key' = m.from_key
          limit 1
       ) f on true
   )
 where jsonb_typeof(sp.required_documents) = 'array'
   and exists (
     select 1
       from jsonb_array_elements(sp.required_documents) x,
            (values
              ('출생증명서%',                 'document_family_cert'),
              ('부모 신분증',                  'dt_9rg10m7'),
              ('부모의 신분증 혹은 여권 사본', 'doc_uqbacc'),
              ('호적',                         'doc_11j9l')
            ) as m(name_pat, from_key)
      where trim(x->>'name_ko') like m.name_pat
        and x->>'std_key' = m.from_key
   );

-- 2. 요강↔항목 행 — 이제 JSONB 가 가리키지 않는 옛 항목 행은 지우고, 새 항목 행은 0060 규칙대로 넣는다
delete from public.study_spec_doc_items r
 where r.item_key in ('item_dt_9rg10m7', 'item_doc_uqbacc', 'item_doc_11j9l')
   and not exists (
     select 1 from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
      where sp.id = r.spec_id
        and 'item_' || (x->>'std_key')
            || case when coalesce(x->>'target_person','') not in ('', 'self')
                    then '__' || (x->>'target_person') else '' end = r.item_key
   );

insert into public.study_spec_doc_items
  (spec_id, item_key, required, sort_order, guide_override_ko, overrides)
select sp.id,
       'item_' || (x.value->>'std_key')
         || case when coalesce(x.value->>'target_person','') not in ('', 'self')
                 then '__' || (x.value->>'target_person') else '' end,
       coalesce((x.value->>'required')::boolean, true),
       x.ordinality,
       nullif(trim(coalesce(x.value->>'notes','')), ''),
       case when nullif(trim(coalesce(x.value->>'notarization','')), '') is not null
            then jsonb_build_object('standards', jsonb_build_object(x.value->>'std_key',
                   jsonb_build_object('notarization', x.value->>'notarization')))
            else '{}'::jsonb end
  from public.study_admission_specs sp,
       jsonb_array_elements(sp.required_documents) with ordinality as x(value, ordinality)
 where x.value->>'std_key' in ('document_birth_cert', 'doc_1mr8dkd', 'document_family_cert')
   and exists (select 1 from public.study_doc_items i
                where i.key = 'item_' || (x.value->>'std_key')
                  || case when coalesce(x.value->>'target_person','') not in ('', 'self')
                          then '__' || (x.value->>'target_person') else '' end)
on conflict (spec_id, item_key) do nothing;

-- 3. 아무도 안 쓰는 죽은 서류·항목 지우기
--    죽은 서류 = 비활성. 안 쓴다 = 요강 JSONB std_key 없음, 학생 파일 키 없음,
--    자동 생성 항목 외의 항목 선택지에 없음. 그 자동 항목도 요강·다른 항목이 안 쓸 때만.
delete from public.study_doc_items i
 where i.is_active = false
   and i.key like 'item_%'
   and exists (select 1 from public.study_doc_standards s
                where s.is_active = false
                  and (i.key = 'item_' || s.key or i.key like 'item_' || s.key || '\_\_%'))
   and not exists (select 1 from public.study_spec_doc_items r where r.item_key = i.key)
   and not exists (
     select 1 from public.study_doc_items o, jsonb_array_elements(o.variants) v,
                 jsonb_array_elements(v->'slots') sl, jsonb_array_elements(sl->'options') op
      where o.key <> i.key and op->>'item' = i.key
   );

delete from public.study_doc_standards s
 where s.is_active = false
   and not exists (
     select 1 from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
      where x->>'std_key' = s.key
   )
   and not exists (
     select 1 from public.study_student_submission_files f
      where f.doc_key like 'std::' || s.key || '::%'
   )
   and not exists (
     select 1 from public.study_doc_items o, jsonb_array_elements(o.variants) v,
                 jsonb_array_elements(v->'slots') sl, jsonb_array_elements(sl->'options') op
      where op->>'standard' = s.key
   );

-- 확인
--   wrong_birth_left 0 · wrong_parent_left 0 · dead_used_left 0
--   birth_item_specs 9 (원래 4 + 고친 5) · standards 35 · inactive_standards_left 4 · items 36 · spec_items 129
select
  (select count(*) from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
    where trim(x->>'name_ko') like '출생증명서%' and x->>'std_key' = 'document_family_cert') as wrong_birth_left,
  (select count(*) from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
    where x->>'std_key' in ('dt_9rg10m7') and trim(x->>'name_ko') = '부모 신분증') as wrong_parent_left,
  (select count(*) from public.study_spec_doc_items where item_key in ('item_dt_9rg10m7','item_doc_uqbacc','item_doc_11j9l')) as dead_used_left,
  (select count(*) from public.study_spec_doc_items where item_key = 'item_document_birth_cert') as birth_item_specs,
  (select count(*) from public.study_doc_standards) as standards,
  (select count(*) from public.study_doc_standards where not is_active) as inactive_standards_left,
  (select count(*) from public.study_doc_items) as items,
  (select count(*) from public.study_spec_doc_items) as spec_items;
