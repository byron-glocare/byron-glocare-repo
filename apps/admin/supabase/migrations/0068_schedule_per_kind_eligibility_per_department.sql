-- =============================================================================
-- 0068: 모집 일정을 일반학과/어학당 따로 · 지원 자격을 학과마다 · 어학연수 프로그램 정보를 어학당 학과로
--
-- 운영자 결정(2026-09-17):
--   1) 모집 일정: 같은 봄학기라도 일반학과와 어학당 일정이 다르다. 학기마다 둘 다 따로 둔다(필수).
--   2) 지원 자격: 학과마다 따로 (어학당은 TOPIK 불필요, 요양보호사 학과는 2급 등). "요강 공통" 개념 삭제.
--   3) 요강 맨 끝 "어학연수 프로그램"(시간·주수·시간표·비자)은 한국어학연수(어학당) 학과 안으로.
--   4) "합격 후 절차" 섹션 삭제 (화면에서만 — metadata 값은 그대로 둔다).
--
-- 하는 일:
--   · study_spec_terms.schedule_language 추가. 어학당만 모집하던 학기(어학연수 요강에서 온 것)는
--     기존 일정을 어학당 일정으로 옮기고 일반학과 일정은 비운다.
--   · 학과 자격이 비어 있으면 요강 공통 자격을 복사해 넣는다 (이후 학과마다 따로 고친다).
--   · metadata.language_program 을 어학당 학과의 info.language_program 으로 복사한다.
-- 여러 번 돌려도 같다.
-- =============================================================================

alter table public.study_spec_terms
  add column if not exists schedule_language jsonb not null default '{}'::jsonb;
comment on column public.study_spec_terms.schedule is '일반학과 모집 일정';
comment on column public.study_spec_terms.schedule_language is '어학당 모집 일정 (같은 학기라도 따로)';

-- 어학당만 모집하는 학기 → 일정을 어학당 쪽으로
update public.study_spec_terms t
   set schedule_language = t.schedule,
       schedule = '{}'::jsonb,
       updated_at = timezone('utc', now())
  from public.study_admission_specs sp
 where sp.id = t.spec_id
   and t.schedule_language = '{}'::jsonb
   and t.schedule <> '{}'::jsonb
   and exists (select 1 from public.study_offerings o
                 join public.study_spec_departments sd on sd.spec_id = sp.id and sd.department_id = o.department_id
                where o.university_id = sp.university_id and o.term = t.term and sd.kind = 'language')
   and not exists (select 1 from public.study_offerings o
                     join public.study_spec_departments sd on sd.spec_id = sp.id and sd.department_id = o.department_id
                    where o.university_id = sp.university_id and o.term = t.term and sd.kind = 'regular');

-- 지원 자격: 비어 있는 학과에 요강 공통 자격 복사
update public.study_spec_departments sd
   set eligibility = sp.eligibility,
       updated_at = timezone('utc', now())
  from public.study_admission_specs sp
 where sp.id = sd.spec_id
   and sd.eligibility is null
   and sp.eligibility is not null
   and jsonb_typeof(sp.eligibility) = 'object';

-- 어학연수 프로그램 정보 → 어학당 학과 info.language_program
update public.study_spec_departments sd
   set info = coalesce(sd.info, '{}'::jsonb) || jsonb_build_object('language_program', sp.metadata->'language_program'),
       updated_at = timezone('utc', now())
  from public.study_admission_specs sp
 where sp.id = sd.spec_id
   and sd.kind = 'language'
   and jsonb_typeof(sp.metadata->'language_program') = 'object'
   and sp.metadata->'language_program' <> '{}'::jsonb
   and not (coalesce(sd.info, '{}'::jsonb) ? 'language_program');

-- 확인 — 예상: terms 16, language_only_terms 4(동남보건·군장·동의과학 2026-Winter, 경남정보 2026-Spring),
--   depts_without_eligibility 0(요강 자격이 비어 있던 대학 학과는 남을 수 있음), language_depts_with_program ≥ 0
select
  (select count(*) from public.study_spec_terms) as terms,
  (select count(*) from public.study_spec_terms where schedule_language <> '{}'::jsonb) as terms_with_language_schedule,
  (select count(*) from public.study_spec_departments where eligibility is null) as depts_without_eligibility,
  (select count(*) from public.study_spec_departments where kind = 'language' and info ? 'language_program') as language_depts_with_program;
