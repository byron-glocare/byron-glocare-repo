-- =============================================================================
-- 0067b: 모집요강을 대학당 1개로 합본 + 학과·학기·서류·양식·지원서 옮기기 (2/2)
--
-- 전제: 0066(군장대 입학지원서 복구), 0067a(스키마) 가 먼저 적용돼 있어야 한다. 아니면 멈춘다.
--
-- 규칙:
--   · 대학마다 대표 요강 = 승인본 중 학기가 가장 늦은 것(같으면 최근 생성). 승인본이 없으면 아무거나.
--     나머지 요강은 status='archived' 로 보관(삭제 안 함). id 는 대표 요강 것이 유지된다.
--   · 옛 요강의 학과 JSONB → 요강 학과(study_spec_departments). 과정이 어학연수면 어학당(kind=language).
--     학과 마스터(departments)는 이름으로 찾고 없으면 active=false 로 만든다.
--     어학연수 요강이 없는 대학에도 어학당 1개를 만든다(기본값).
--   · 학과가 여러 요강에 겹치면(목포 3개 학기) 학기가 늦은 요강 것이 남는다.
--   · 요강↔항목 행: 옛 요강 → 그 요강이 담은 학과마다 복사. 학비·장학금·자격도 학과로.
--   · 학기: 옛 요강마다 study_spec_terms(일정). 모집(study_offerings)은 대표 요강으로 연결하고,
--     옛 요강의 (학기, 학과) 중 모집 행이 없는 것은 draft 로 만든다.
--   · 지원서: 대표 요강으로 옮기고 term 채움. 학과 id 가 비었으면 이름으로 맞춘다.
--   · 작성서류 양식(현행): 적용 학과 id 나 학과명이 있으면 그 학과에, 없으면 옛 요강 JSONB 에
--     같은 종류의 작성서류가 있는 학과마다 붙인다. 첫 학과는 원래 행, 나머지는 복사 행(같은 파일).
--
-- 안전: 지우는 것 없음(요강은 보관, 옛 항목 행만 학과로 복사 후 삭제 — 백업 _backup_0067_*).
-- =============================================================================

do $do$
begin
  if not exists (select 1 from public.study_admission_form_files where id = 'ebe5a156-ab04-4314-b288-cdff19ba4621' and is_current) then
    raise exception '0066 이 아직 적용되지 않았습니다. 0066 을 먼저 실행하세요.';
  end if;
  if to_regclass('public.study_spec_departments') is null then
    raise exception '0067a 가 아직 적용되지 않았습니다.';
  end if;
  if to_regclass('public._backup_0067_specs') is null then
    execute 'create table public._backup_0067_specs as select * from public.study_admission_specs';
    execute 'create table public._backup_0067_spec_doc_items as select * from public.study_spec_doc_items';
    execute 'create table public._backup_0067_applications as select id, admission_spec_id, target_department_id, target_department_label, offering_id from public.study_applications';
    execute 'create table public._backup_0067_offerings as select * from public.study_offerings';
    execute 'create table public._backup_0067_form_files as select id, spec_department_id, department_name, applies_to_department_ids, is_current from public.study_admission_form_files';
  end if;
end
$do$;

do $do$
declare
  u record;
  s record;
  d jsonb;
  primary_id uuid;
  dept_id bigint;
  sd_id uuid;
  lang_sd uuid;
  ord int;
  form_key_of_std constant jsonb := '{"doc_form_application":"application_form","doc_form_self_intro":"self_intro","doc_form_study_plan":"study_plan","doc_form_financial_pledge":"financial_pledge_form","doc_form_privacy_consent":"privacy_consent","doc_form_record_release":"academic_record_release","doc_form_recommendation":"recommendation_letter"}'::jsonb;
  f record;
  first_sd uuid;
  n int;
begin
  for u in select distinct university_id from public.study_admission_specs order by university_id loop

    -- 대표 요강
    select id into primary_id from public.study_admission_specs
     where university_id = u.university_id
     order by (status = 'approved') desc, term desc, created_at desc
     limit 1;

    -- 옛 요강을 학기 늦은 순으로 (겹치는 학과는 앞의 것이 남는다)
    for s in select * from public.study_admission_specs
              where university_id = u.university_id
              order by (id = primary_id) desc, (status = 'approved') desc, term desc, created_at desc loop

      -- 학기 (일정)
      insert into public.study_spec_terms (spec_id, term, schedule, sort_order)
      values (primary_id, s.term, coalesce(s.schedule, '{}'::jsonb), 0)
      on conflict (spec_id, term) do nothing;

      dept_id := null;
      if s.program_type = 'language_program' then
        -- 어학당: 학과 마스터에서 어학 계열을 찾는다 (활성 우선, 이름에 어학/한국어/연수)
        -- (학과 마스터의 course 값은 믿지 않는다 — 일반학과에 language 가 박힌 곳이 있다. 이름만 본다.)
        select id into dept_id from public.departments
         where university_id = u.university_id and name_ko ~ '(어학|한국어|연수)'
         order by active desc, (course = 'language') desc, id
         limit 1;
        if dept_id is null then
          insert into public.departments (university_id, name_ko, course, active, sort_order)
          values (u.university_id, '한국어 어학연수', 'language', false, 0) returning id into dept_id;
        end if;
        d := coalesce(s.departments->0, '{}'::jsonb);
        insert into public.study_spec_departments (spec_id, department_id, kind, info, tuition, scholarships, eligibility, sort_order)
        values (primary_id, dept_id, 'language', d, coalesce(s.tuition, '{}'::jsonb), coalesce(s.scholarships, '[]'::jsonb),
                case when s.id = primary_id then null else s.eligibility end, 0)
        on conflict (spec_id, department_id) do nothing;
        select id into sd_id from public.study_spec_departments where spec_id = primary_id and department_id = dept_id;
        -- 옛 요강의 항목 행 → 이 학과
        insert into public.study_spec_doc_items (spec_id, spec_department_id, item_key, required, sort_order, guide_override_ko, guide_override_vi, overrides)
        select primary_id, sd_id, r.item_key, r.required, r.sort_order, r.guide_override_ko, r.guide_override_vi, r.overrides
          from public.study_spec_doc_items r
         where r.spec_id = s.id and r.spec_department_id is null
        on conflict (spec_department_id, item_key) where spec_department_id is not null do nothing;
        -- 모집 행
        if not exists (select 1 from public.study_offerings where university_id = u.university_id and department_id = dept_id and term = s.term) then
          insert into public.study_offerings (university_id, department_id, term, status, source_spec_id, sort_order)
          values (u.university_id, dept_id, s.term, case when s.status = 'approved' then 'draft' else 'draft' end, primary_id, 0);
        end if;
      else
        ord := 0;
        for d in select * from jsonb_array_elements(coalesce(s.departments, '[]'::jsonb)) loop
          ord := ord + 10;
          dept_id := null;
          -- 학과 마스터: 이름이 같거나 서로 포함
          -- 수동 매핑: 이름으로 못 맞추는 것 (춘해 "글로벌케어과" = 글로벌 헬스케어·돌봄 전공)
          select m.dept_id into dept_id
            from (values (7, '글로벌케어과')) as m(dept_id, name)
            join public.departments dp on dp.id = m.dept_id and dp.university_id = u.university_id
           where lower(replace(m.name, ' ', '')) = lower(replace(coalesce(d->>'name', ''), ' ', ''))
           limit 1;
          if dept_id is null then
          select id into dept_id from public.departments
           where university_id = u.university_id
             and name_ko !~ '(어학|한국어|연수)'
             and (
               lower(replace(name_ko, ' ', '')) = lower(replace(coalesce(d->>'name', ''), ' ', ''))
               or lower(replace(name_ko, ' ', '')) like '%' || lower(replace(coalesce(d->>'name', ''), ' ', '')) || '%'
               or lower(replace(coalesce(d->>'name', ''), ' ', '')) like '%' || lower(replace(name_ko, ' ', '')) || '%'
             )
           order by active desc, (lower(replace(name_ko, ' ', '')) = lower(replace(coalesce(d->>'name', ''), ' ', ''))) desc, id
           limit 1;
          end if;
          if dept_id is null then
            insert into public.departments (university_id, name_ko, course, active, sort_order)
            values (u.university_id, coalesce(nullif(d->>'name', ''), '학과'), 'direct', false, ord) returning id into dept_id;
          end if;
          insert into public.study_spec_departments (spec_id, department_id, kind, info, tuition, scholarships, eligibility, sort_order)
          values (primary_id, dept_id, 'regular', d, coalesce(s.tuition, '{}'::jsonb), coalesce(s.scholarships, '[]'::jsonb),
                  case when s.id = primary_id then null else s.eligibility end, ord)
          on conflict (spec_id, department_id) do nothing;
          select id into sd_id from public.study_spec_departments where spec_id = primary_id and department_id = dept_id;
          insert into public.study_spec_doc_items (spec_id, spec_department_id, item_key, required, sort_order, guide_override_ko, guide_override_vi, overrides)
          select primary_id, sd_id, r.item_key, r.required, r.sort_order, r.guide_override_ko, r.guide_override_vi, r.overrides
            from public.study_spec_doc_items r
           where r.spec_id = s.id and r.spec_department_id is null
          on conflict (spec_department_id, item_key) where spec_department_id is not null do nothing;
          if not exists (select 1 from public.study_offerings where university_id = u.university_id and department_id = dept_id and term = s.term) then
            insert into public.study_offerings (university_id, department_id, term, status, source_spec_id, sort_order)
            values (u.university_id, dept_id, s.term, 'draft', primary_id, ord);
          end if;
        end loop;
      end if;

      -- 모집·지원서를 대표 요강으로
      update public.study_offerings set source_spec_id = primary_id where source_spec_id = s.id;
      update public.study_applications set admission_spec_id = primary_id, term = coalesce(term, s.term) where admission_spec_id = s.id;
    end loop;

    -- 어학당이 없는 대학에도 기본 어학당 1개
    if not exists (select 1 from public.study_spec_departments where spec_id = primary_id and kind = 'language') then
      dept_id := null;
      select id into dept_id from public.departments
       where university_id = u.university_id and name_ko ~ '(어학|한국어|연수)'
       order by active desc, (course = 'language') desc, id limit 1;
      if dept_id is null then
        insert into public.departments (university_id, name_ko, course, active, sort_order)
        values (u.university_id, '한국어 어학연수', 'language', false, 0) returning id into dept_id;
      end if;
      insert into public.study_spec_departments (spec_id, department_id, kind, info, sort_order)
      values (primary_id, dept_id, 'language', jsonb_build_object('name', '한국어 어학연수', 'program_kind', 'language'), 0)
      on conflict (spec_id, department_id) do nothing;
    end if;

    -- 지원서 학과 id 채우기: 이름으로, 안 되면 요강 학과가 하나뿐일 때 그것
    update public.study_applications a
       set target_department_id = m.department_id
      from (
        select a2.id as app_id, sd.department_id
          from public.study_applications a2
          join public.study_spec_departments sd on sd.spec_id = a2.admission_spec_id and sd.kind = 'regular'
          join public.departments dp on dp.id = sd.department_id
         where a2.admission_spec_id = primary_id and a2.target_department_id is null
           and (lower(replace(coalesce(a2.target_department_label, ''), ' ', '')) like '%' || lower(replace(dp.name_ko, ' ', '')) || '%'
                or lower(replace(dp.name_ko, ' ', '')) like '%' || lower(replace(coalesce(a2.target_department_label, ''), ' ', '')) || '%')
      ) m
     where a.id = m.app_id;
    update public.study_applications a
       set target_department_id = (select sd.department_id from public.study_spec_departments sd where sd.spec_id = primary_id and sd.kind = 'regular')
     where a.admission_spec_id = primary_id and a.target_department_id is null
       and (select count(*) from public.study_spec_departments sd where sd.spec_id = primary_id and sd.kind = 'regular') = 1;

    -- 작성서류 양식(현행) → 요강 학과
    for f in select ff.* from public.study_admission_form_files ff
              where ff.university_id = u.university_id and ff.is_current and ff.spec_department_id is null loop
      first_sd := null;
      for sd_id in
        select sd.id from public.study_spec_departments sd
          join public.departments dp on dp.id = sd.department_id
         where sd.spec_id = primary_id
           and (
             -- 1) 적용 학과 id / 학과명이 지정된 양식
             (coalesce(array_length(f.applies_to_department_ids, 1), 0) > 0 and sd.department_id = any(f.applies_to_department_ids))
             or (f.department_name is not null and lower(replace(dp.name_ko, ' ', '')) = lower(replace(f.department_name, ' ', '')))
             -- 2) 지정이 없으면: 이 학과를 담은 옛 요강 JSONB 에 같은 종류의 작성서류가 있는 학과
             or (coalesce(array_length(f.applies_to_department_ids, 1), 0) = 0 and f.department_name is null
                 and exists (
                   select 1 from public.study_admission_specs os, jsonb_array_elements(coalesce(os.required_documents, '[]'::jsonb)) x
                    where os.university_id = u.university_id
                      and (x->>'key' = f.key or form_key_of_std->>coalesce(x->>'std_key', '') = f.key)
                      and (
                        (sd.kind = 'language' and os.program_type = 'language_program')
                        or (sd.kind = 'regular' and os.program_type <> 'language_program'
                            and exists (select 1 from jsonb_array_elements(coalesce(os.departments, '[]'::jsonb)) od
                                         where lower(replace(coalesce(od->>'name', ''), ' ', '')) = lower(replace(coalesce(sd.info->>'name', dp.name_ko), ' ', ''))
                                            or lower(replace(dp.name_ko, ' ', '')) like '%' || lower(replace(coalesce(od->>'name', ''), ' ', '')) || '%'))
                      )
                 ))
           )
         order by sd.kind desc, sd.sort_order, sd.id
      loop
        if first_sd is null then
          first_sd := sd_id;
          update public.study_admission_form_files set spec_department_id = sd_id, updated_at = timezone('utc', now()) where id = f.id;
        else
          -- 복사 행 (같은 파일·슬롯·서술형 설정), 이 학과의 현행
          insert into public.study_admission_form_files
            (university_id, department_name, key, name_ko, file_url, file_name, size_bytes, mime_type, is_current, uploaded_by, uploaded_at,
             notes, required_data_type_keys, essay_questions, applies_to_terms, applies_to_department_ids, spec_department_id,
             field_overlays, label_mapping, slot_mapping, is_essay, essay_sections)
          select university_id, department_name, key, name_ko, file_url, file_name, size_bytes, mime_type, true, uploaded_by, uploaded_at,
                 notes, required_data_type_keys, essay_questions, applies_to_terms, applies_to_department_ids, sd_id,
                 field_overlays, label_mapping, slot_mapping, is_essay, essay_sections
            from public.study_admission_form_files where id = f.id;
        end if;
      end loop;
    end loop;

    -- 대표 요강 정리: 학과 JSONB 캐시(옛 읽기용) · 학기 = 가장 늦은 학기 · 나머지 요강 보관
    update public.study_admission_specs p
       set departments = (
             select coalesce(jsonb_agg(sd.info || jsonb_build_object('name', coalesce(nullif(sd.info->>'name', ''), dp.name_ko), 'program_kind', case when sd.kind = 'language' then 'language' else 'degree' end)
                                       order by sd.kind desc, sd.sort_order), '[]'::jsonb)
               from public.study_spec_departments sd join public.departments dp on dp.id = sd.department_id
              where sd.spec_id = primary_id),
           term = (select max(term) from public.study_spec_terms where spec_id = primary_id),
           updated_at = timezone('utc', now())
     where p.id = primary_id;
    update public.study_admission_specs set status = 'archived', updated_at = timezone('utc', now())
     where university_id = u.university_id and id <> primary_id and status <> 'archived';
  end loop;

  -- 학과로 옮긴 옛 항목 행(학과 없음)은 지운다 — 백업은 _backup_0067_spec_doc_items
  delete from public.study_spec_doc_items where spec_department_id is null;
end
$do$;

-- 이제 대학당 활성 요강 1개
create unique index if not exists study_admission_specs_one_per_university
  on public.study_admission_specs(university_id) where status <> 'archived';

-- 확인 — 예상: active_specs 13, archived 3, spec_departments ≈ 57(어학당 13 포함), terms 16,
--   doc_items_without_dept 0, apps_without_dept 0, apps_without_term 0, current_forms_without_dept 0
select
  (select count(*) from public.study_admission_specs where status <> 'archived') as active_specs,
  (select count(*) from public.study_admission_specs where status = 'archived') as archived_specs,
  (select count(*) from public.study_spec_departments) as spec_departments,
  (select count(*) from public.study_spec_departments where kind = 'language') as language_depts,
  (select count(*) from public.study_spec_terms) as terms,
  (select count(*) from public.study_spec_doc_items) as doc_items,
  (select count(*) from public.study_spec_doc_items where spec_department_id is null) as doc_items_without_dept,
  (select count(*) from public.study_applications where target_department_id is null) as apps_without_dept,
  (select count(*) from public.study_applications where term is null) as apps_without_term,
  (select count(*) from public.study_admission_form_files where is_current and spec_department_id is null) as current_forms_without_dept,
  (select count(*) from public.study_offerings where source_spec_id is null) as offerings_without_spec;
