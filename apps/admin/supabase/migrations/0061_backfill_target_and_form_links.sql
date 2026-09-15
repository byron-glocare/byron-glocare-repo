-- =============================================================================
-- 0061: 요강 서류의 대상자·작성서류 표준 연결 채우기 → 0060 다시 실행
--
-- 0060 실행 결과(standards 60 / items 60 / spec_items 129 / unlinked 59)가 말해준 것:
--
--   1) items = standards 였다 = 대상자별 항목(item_<키>__father 등)이 하나도 안 생겼다.
--      요강 서류의 target_person 이 전부 비어 있다는 뜻이다. 아버지/어머니 신분증은
--      이름("아버지의 신분증 혹은 여권")으로만 구분돼 있었고, 0057 이 두 서류를 같은
--      표준으로 합치면서 이름 말고는 구분할 게 없어졌다. 4d7ae41 응급 수정(대상자로
--      칸·파일키 분리)은 target_person 이 있어야 동작하므로, 여기서 이름으로 채운다.
--      그리고 unique(spec_id, item_key) 때문에 아버지·어머니 중 뒤의 것은 0060 에서
--      떨어져 나갔다 → 요강↔항목 행을 지우고 0060 을 다시 돌려 다시 만든다.
--
--   2) unlinked 59 중 상당수는 작성서류(입학원서·자기소개서…)다. 예전 코드가 작성서류의
--      std_key 를 일부러 비웠기 때문(required-documents-field 의 isFormDoc ? null).
--      0058 이 작성서류 표준 7종을 만들어 뒀으니 A key 로 자동 연결할 수 있다.
--
-- 순서: 이 파일 실행 → 0060 다시 실행 (0060 은 여러 번 돌려도 안전하게 짜여 있다).
--
-- ⚠ study_spec_doc_items 를 비운다. 지금은 전부 0060 이 JSONB 에서 자동 생성한 행이고
--   운영자가 손댄 행이 없어서 안전하다. 모집요강 편집이 이 테이블에 쓰기 시작한 뒤엔
--   절대 이 방식으로 다시 하지 않는다.
-- =============================================================================

-- 0. 백업 (있으면 보존)
do $do$
begin
  if to_regclass('public._backup_0061_specs') is null then
    create table public._backup_0061_specs as
      select id, required_documents from public.study_admission_specs;
    raise notice '0061: _backup_0061_specs 생성';
  end if;
end
$do$;

-- 1. 대상자 채우기 — target_person 이 비어 있고 이름에 단서가 있는 서류만
update public.study_admission_specs s
   set required_documents = (
         select coalesce(jsonb_agg(
           case
             when coalesce(d.value->>'target_person','') = '' and d.value->>'name_ko' ~ '(아버지|부친)'
               then d.value || '{"target_person":"father"}'::jsonb
             when coalesce(d.value->>'target_person','') = '' and d.value->>'name_ko' ~ '(어머니|모친)'
               then d.value || '{"target_person":"mother"}'::jsonb
             when coalesce(d.value->>'target_person','') = '' and d.value->>'name_ko' ~ '(보호자|재정보증|보증인)'
               then d.value || '{"target_person":"other"}'::jsonb
             else d.value
           end order by d.ordinality), '[]'::jsonb)
           from jsonb_array_elements(s.required_documents) with ordinality as d(value, ordinality)
       ),
       updated_at = timezone('utc', now())
 where exists (
   select 1 from jsonb_array_elements(s.required_documents) x
    where coalesce(x->>'target_person','') = ''
      and x->>'name_ko' ~ '(아버지|부친|어머니|모친|보호자|재정보증|보증인)'
 );

-- 2. 작성서류 표준 연결 — std_key 비었고 A key 가 작성서류면 0058 표준으로
drop table if exists public._form_link_0061;
create table public._form_link_0061(a_key text primary key, std_key text not null);
insert into public._form_link_0061 values
  ('application_form',        'doc_form_application'),
  ('self_intro',              'doc_form_self_intro'),
  ('study_plan',              'doc_form_study_plan'),
  ('financial_pledge_form',   'doc_form_financial_pledge'),
  ('privacy_consent',         'doc_form_privacy_consent'),
  ('academic_record_release', 'doc_form_record_release'),
  ('recommendation_letter',   'doc_form_recommendation');

update public.study_admission_specs s
   set required_documents = (
         select coalesce(jsonb_agg(
           case when coalesce(d.value->>'std_key','') in ('', '__none__') and m.std_key is not null
                then d.value || jsonb_build_object('std_key', m.std_key)
                else d.value end
           order by d.ordinality), '[]'::jsonb)
           from jsonb_array_elements(s.required_documents) with ordinality as d(value, ordinality)
           left join public._form_link_0061 m on m.a_key = d.value->>'key'
       ),
       updated_at = timezone('utc', now())
 where exists (
   select 1 from jsonb_array_elements(s.required_documents) x
   join public._form_link_0061 m2 on m2.a_key = x->>'key'
   where coalesce(x->>'std_key','') in ('', '__none__')
 );
drop table public._form_link_0061;

-- 3. 자동 생성된 요강↔항목 행을 비운다 (0060 재실행이 다시 만든다)
delete from public.study_spec_doc_items;

-- 확인 — 대상자 채워진 서류 수, 아직 미연결 수. 이 다음에 0060 을 다시 실행한다.
select
  (select count(*) from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
    where coalesce(x->>'target_person','') not in ('', 'self')) as docs_with_target,
  (select count(*) from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
    where coalesce(x->>'std_key','') in ('', '__none__')) as still_unlinked;
