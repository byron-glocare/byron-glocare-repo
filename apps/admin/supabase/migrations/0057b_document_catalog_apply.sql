-- =============================================================================
-- 0057b: 표준 발급서류 카탈로그 정리 — 2단계 (적용)
--
--   ⚠ 0057a 를 먼저 실행해야 한다. (_doc_merge_0057 / _doc_fix_0057 이 있어야 함)
--
--   하는 일 — 흡수될 22개를 정본으로 병합하고, 키가 박힌 자리를 전부 치환한다:
--     1. 흡수된 라벨을 정본 aliases 로 편입 (그 이름이 또 와도 새 표준이 안 생김)
--     2. 모집요강 required_documents[].std_key
--     3. 직접제출 서류 std_key / required_data_type_keys[]   (테이블 있을 때만)
--     4. 양식파일 required_data_type_keys[] / slot_mapping / field_overlays
--        / essay_sections[].basis_keys[]
--     5. 서술형 초안 basis_data_keys[]
--     6. 학생이 올린 값 data_type_key
--     7. 명백한 오매핑 3종 수정
--     8. 정본 라벨 정리 / 흡수분 비활성화
--
--   안전:
--     · 행을 지우지 않는다. 흡수된 표준은 is_active=false 로만 바꾸고,
--       학생이 올린 값도 삭제하지 않는다.
--     · **여러 번 돌려도 안전하다** — 모든 치환이 "옛 키가 아직 남아 있을 때만" 동작한다.
--     · 되돌리는 SQL 은 파일 맨 아래.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 흡수된 라벨을 정본의 별칭으로 편입
-- -----------------------------------------------------------------------------
update public.study_student_data_types t
   set aliases = (
         select array(
           select distinct x
             from unnest(
               coalesce(t.aliases, '{}'::text[])
               || array(
                    select s.label_ko
                      from public.study_student_data_types s
                      join public._doc_merge_0057 m on m.old_key = s.key
                     where m.new_key = t.key
                  )
             ) as x
            where x is not null and btrim(x) <> '' and x <> t.label_ko
         )
       ),
       updated_at = timezone('utc', now())
 where t.key in (select distinct new_key from public._doc_merge_0057);

-- -----------------------------------------------------------------------------
-- 2. 모집요강 required_documents[].std_key
-- -----------------------------------------------------------------------------
update public.study_admission_specs s
   set required_documents = (
         select coalesce(
                  jsonb_agg(
                    case when m.new_key is not null
                         then jsonb_set(d.value, '{std_key}', to_jsonb(m.new_key))
                         else d.value end
                    order by d.ordinality
                  ),
                  '[]'::jsonb
                )
           from jsonb_array_elements(s.required_documents)
                  with ordinality as d(value, ordinality)
           left join public._doc_merge_0057 m on m.old_key = d.value->>'std_key'
       ),
       updated_at = timezone('utc', now())
 where exists (
         select 1
           from jsonb_array_elements(s.required_documents) as x(value)
           join public._doc_merge_0057 m2 on m2.old_key = x.value->>'std_key'
       );

-- -----------------------------------------------------------------------------
-- 3. 직접제출 서류 — 테이블이 있는 환경에서만 (운영 DB 에는 없음)
--    동적 SQL 이라 테이블이 없어도 파싱 단계에서 죽지 않는다.
-- -----------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.study_required_submissions') is null then
    raise notice '0057b: study_required_submissions 없음 - 3단계 건너뜀';
    return;
  end if;

  execute $q$
    update public.study_required_submissions r
       set std_key = m.new_key, updated_at = now()
      from public._doc_merge_0057 m
     where r.std_key = m.old_key
  $q$;

  execute $q$
    update public.study_required_submissions r
       set required_data_type_keys = (
             select array(
               select distinct coalesce(m.new_key, k.v)
                 from unnest(r.required_data_type_keys) as k(v)
                 left join public._doc_merge_0057 m on m.old_key = k.v
             )
           ),
           updated_at = now()
     where exists (
             select 1 from unnest(r.required_data_type_keys) as k2(v)
              join public._doc_merge_0057 m2 on m2.old_key = k2.v
           )
  $q$;
end
$do$;

-- -----------------------------------------------------------------------------
-- 4. 양식파일
-- -----------------------------------------------------------------------------

-- 4-1. required_data_type_keys[]
update public.study_admission_form_files f
   set required_data_type_keys = (
         select array(
           select distinct coalesce(m.new_key, k.v)
             from unnest(f.required_data_type_keys) as k(v)
             left join public._doc_merge_0057 m on m.old_key = k.v
         )
       ),
       updated_at = timezone('utc', now())
 where exists (
         select 1 from unnest(f.required_data_type_keys) as k2(v)
          join public._doc_merge_0057 m2 on m2.old_key = k2.v
       );

-- 4-2. slot_mapping — { "빈칸인덱스": 표준키 }
update public.study_admission_form_files f
   set slot_mapping = (
         select jsonb_object_agg(kv.key, coalesce(to_jsonb(m.new_key), kv.value))
           from jsonb_each(f.slot_mapping) as kv
           left join public._doc_merge_0057 m on m.old_key = kv.value #>> '{}'
       ),
       updated_at = timezone('utc', now())
 where f.slot_mapping is not null
   and jsonb_typeof(f.slot_mapping) = 'object'
   and exists (
         select 1 from jsonb_each(f.slot_mapping) as kv2
          join public._doc_merge_0057 m2 on m2.old_key = kv2.value #>> '{}'
       );

-- 4-3. field_overlays[].key / .dataKey (PDF 좌표 배치)
update public.study_admission_form_files f
   set field_overlays = (
         select coalesce(
                  jsonb_agg(
                    (case when mk.new_key is not null
                          then jsonb_set(o.value, '{key}', to_jsonb(mk.new_key))
                          else o.value end)
                    || (case when md.new_key is not null
                             then jsonb_build_object('dataKey', md.new_key)
                             else '{}'::jsonb end)
                    order by o.ordinality
                  ),
                  '[]'::jsonb
                )
           from jsonb_array_elements(f.field_overlays)
                  with ordinality as o(value, ordinality)
           left join public._doc_merge_0057 mk on mk.old_key = o.value->>'key'
           left join public._doc_merge_0057 md on md.old_key = o.value->>'dataKey'
       ),
       updated_at = timezone('utc', now())
 where f.field_overlays is not null
   and jsonb_typeof(f.field_overlays) = 'array'
   and exists (
         select 1 from jsonb_array_elements(f.field_overlays) as x(value)
          join public._doc_merge_0057 m2
            on m2.old_key = x.value->>'key' or m2.old_key = x.value->>'dataKey'
       );

-- 4-4. essay_sections[].basis_keys[]
--      basis_keys 가 배열인 섹션만 손댄다 (없는 섹션에 빈 배열을 새로 만들지 않음).
update public.study_admission_form_files f
   set essay_sections = (
         select coalesce(
                  jsonb_agg(
                    case when jsonb_typeof(e.value->'basis_keys') = 'array'
                         then jsonb_set(
                                e.value,
                                '{basis_keys}',
                                coalesce(
                                  (select jsonb_agg(distinct coalesce(m.new_key, bk.value #>> '{}'))
                                     from jsonb_array_elements(e.value->'basis_keys') as bk(value)
                                     left join public._doc_merge_0057 m
                                            on m.old_key = bk.value #>> '{}'),
                                  '[]'::jsonb
                                )
                              )
                         else e.value end
                    order by e.ordinality
                  ),
                  '[]'::jsonb
                )
           from jsonb_array_elements(f.essay_sections)
                  with ordinality as e(value, ordinality)
       ),
       updated_at = timezone('utc', now())
 where f.essay_sections is not null
   and jsonb_typeof(f.essay_sections) = 'array'
   and exists (
         select 1
           from jsonb_array_elements(f.essay_sections) as e2(value)
           cross join lateral jsonb_array_elements(
                        case when jsonb_typeof(e2.value->'basis_keys') = 'array'
                             then e2.value->'basis_keys' else '[]'::jsonb end
                      ) as bk2(value)
           join public._doc_merge_0057 m2 on m2.old_key = bk2.value #>> '{}'
       );

-- -----------------------------------------------------------------------------
-- 5. 서술형 초안 basis_data_keys[]
-- -----------------------------------------------------------------------------
update public.study_student_essay_drafts d
   set basis_data_keys = (
         select array(
           select distinct coalesce(m.new_key, k.v)
             from unnest(d.basis_data_keys) as k(v)
             left join public._doc_merge_0057 m on m.old_key = k.v
         )
       ),
       updated_at = timezone('utc', now())
 where exists (
         select 1 from unnest(d.basis_data_keys) as k2(v)
          join public._doc_merge_0057 m2 on m2.old_key = k2.v
       );

-- -----------------------------------------------------------------------------
-- 6. 학생이 올린 값 — 정본 키로 이관.
--    같은 학생이 정본 키 값을 이미 갖고 있으면(UNIQUE 충돌) 건드리지 않는다.
--    남는 값도 지우지 않는다 — 비활성 표준에 매달린 채 보존된다.
-- -----------------------------------------------------------------------------
update public.study_student_data_values v
   set data_type_key = m.new_key
  from public._doc_merge_0057 m
 where v.data_type_key = m.old_key
   and not exists (
         select 1 from public.study_student_data_values v2
          where v2.student_id = v.student_id
            and v2.data_type_key = m.new_key
       );

-- -----------------------------------------------------------------------------
-- 7. 명백한 오매핑 수정
-- -----------------------------------------------------------------------------
update public.study_admission_specs s
   set required_documents = (
         select coalesce(
                  jsonb_agg(
                    case when fx.right_std is not null
                         then jsonb_set(d.value, '{std_key}', to_jsonb(fx.right_std))
                         else d.value end
                    order by d.ordinality
                  ),
                  '[]'::jsonb
                )
           from jsonb_array_elements(s.required_documents)
                  with ordinality as d(value, ordinality)
           left join public._doc_fix_0057 fx
             on fx.a_key = d.value->>'key' and fx.wrong_std = d.value->>'std_key'
       ),
       updated_at = timezone('utc', now())
 where exists (
         select 1
           from jsonb_array_elements(s.required_documents) as x(value)
           join public._doc_fix_0057 fx2
             on fx2.a_key = x.value->>'key' and fx2.wrong_std = x.value->>'std_key'
       );

-- -----------------------------------------------------------------------------
-- 8. 정본 라벨 정리 — 흡수 범위를 라벨이 정확히 말하게
-- -----------------------------------------------------------------------------
update public.study_student_data_types
   set label_ko = '부모 신분증·여권 사본', updated_at = timezone('utc', now())
 where key = 'doc_1mr8dkd' and label_ko <> '부모 신분증·여권 사본';

update public.study_student_data_types
   set label_ko = '가족관계증명서 (호적·CT07)', updated_at = timezone('utc', now())
 where key = 'document_family_cert' and label_ko <> '가족관계증명서 (호적·CT07)';

update public.study_student_data_types
   set label_ko = '한국어능력 입증서류 (TOPIK·KIIP·세종학당)', updated_at = timezone('utc', now())
 where key = 'doc_17us1kp' and label_ko <> '한국어능력 입증서류 (TOPIK·KIIP·세종학당)';

-- -----------------------------------------------------------------------------
-- 9. 흡수된 표준 비활성화 (삭제 아님)
-- -----------------------------------------------------------------------------
update public.study_student_data_types
   set is_active = false, updated_at = timezone('utc', now())
 where key in (select old_key from public._doc_merge_0057)
   and is_active;

-- -----------------------------------------------------------------------------
-- 10. 결과 확인 — active_documents 가 25 이고 dangling 이 0 이면 성공
-- -----------------------------------------------------------------------------
select
  (select count(*) from public.study_student_data_types
    where category = 'document' and is_active) as active_documents,
  (select count(*)
     from public.study_admission_specs s,
          jsonb_array_elements(s.required_documents) d
     join public.study_student_data_types t on t.key = d->>'std_key'
    where not t.is_active) as dangling_refs;

-- =============================================================================
-- 뒷정리 — 위 결과가 25 / 0 으로 확인되면 실행
-- =============================================================================
-- drop table if exists public._doc_merge_0057;
-- drop table if exists public._doc_fix_0057;

-- =============================================================================
-- 확인 쿼리
-- =============================================================================
-- (1) 남은 활성 발급서류 목록
-- select key, label_ko, coalesce(array_length(aliases,1),0) as n_alias
--   from study_student_data_types where category='document' and is_active order by label_ko;
--
-- (2) 검토 목록 — A key 와 std_key 라벨이 어긋나 보이는 것 (사람이 판단)
--     nationality_proof / financial_proof / korean_proof 가 여기 남아 있다.
-- select d->>'key' as a_key, d->>'std_key' as std_key, t.label_ko, count(*) as n
--   from study_admission_specs s, jsonb_array_elements(s.required_documents) d
--   left join study_student_data_types t on t.key = d->>'std_key'
--  where d->>'std_key' is not null
--  group by 1,2,3 order by 1, 4 desc;

-- =============================================================================
-- 되돌리기 — 문제가 생기면 이것만 실행하면 0057a 실행 전 상태로 돌아간다
-- =============================================================================
-- update study_student_data_types t
--    set label_ko=b.label_ko, aliases=b.aliases, is_active=b.is_active
--   from _backup_0057_types b where b.id=t.id;
-- update study_admission_specs s set required_documents=b.required_documents
--   from _backup_0057_specs b where b.id=s.id;
-- update study_admission_form_files f
--    set required_data_type_keys=b.required_data_type_keys, slot_mapping=b.slot_mapping,
--        field_overlays=b.field_overlays, essay_sections=b.essay_sections
--   from _backup_0057_forms b where b.id=f.id;
-- ※ 학생 값(study_student_data_values) 이관은 되돌리지 않는다 — 정본 키로 옮긴 것이 정상 상태다.
-- ※ 문제 없이 안정되면 _backup_0057_* 테이블은 삭제해도 된다.
