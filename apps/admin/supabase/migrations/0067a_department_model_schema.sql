-- =============================================================================
-- 0067a: 모집요강 = 대학당 1개, 학과별 서류·학기별 일정 — 스키마 (1/2)
--
-- 운영자 결정(2026-09-16):
--   · 모집요강은 대학당 1개. 학기·전형·과정으로 쪼개지 않는다.
--   · 요강 안에 [학과 섹션] — 어학당 1개(기본, 삭제 불가) + 일반학과 여러 개.
--     학과마다 작성서류 양식·발급서류 항목·학비·장학금을 각자 가진다. 표준/서브 없음, 복사로 시작.
--   · 요강 안에 [학기 섹션] — 학기마다 일정. 그 학기에 모집하는 학과 = study_offerings 행.
--   · 모집 메뉴는 대학×학과×학기에서 바로 오픈/종료. 요강 연결 단계 없음.
--
-- 이 파일은 테이블·컬럼만 만든다. 데이터 이동(합본)은 0067b. 같은 스크립트에서 만든 테이블을
-- 뒤 문장이 참조하면 Supabase 에디터가 실행 전에 죽으므로 둘로 나눴다. 0066 이 먼저 적용돼 있어야 한다.
-- =============================================================================

-- 1. 요강의 학과 (어학당 포함)
create table if not exists public.study_spec_departments (
  id             uuid primary key default gen_random_uuid(),
  spec_id        uuid not null references public.study_admission_specs(id) on delete cascade,
  department_id  bigint not null references public.departments(id) on delete restrict,
  kind           text not null check (kind in ('language', 'regular')),
  -- 옛 departments JSONB 항목 그대로 (faculty·track·years·capacity·korean_min_topik·notes …)
  info           jsonb not null default '{}'::jsonb,
  tuition        jsonb not null default '{}'::jsonb,
  scholarships   jsonb not null default '[]'::jsonb,
  -- null = 요강 공통 자격(study_admission_specs.eligibility)을 쓴다
  eligibility    jsonb,
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now()),
  unique (spec_id, department_id)
);
create unique index if not exists study_spec_departments_one_language
  on public.study_spec_departments(spec_id) where kind = 'language';
create index if not exists study_spec_departments_dept_idx on public.study_spec_departments(department_id);
comment on table public.study_spec_departments is
  '모집요강의 학과. 어학당은 kind=language 로 요강마다 정확히 1개. 서류·학비·장학은 여기(학과)에 붙는다.';

-- 2. 요강의 학기 (일정)
create table if not exists public.study_spec_terms (
  id          uuid primary key default gen_random_uuid(),
  spec_id     uuid not null references public.study_admission_specs(id) on delete cascade,
  term        text not null check (term ~ '^\d{4}-(Spring|Summer|Fall|Winter|Year)$'),
  schedule    jsonb not null default '{}'::jsonb,
  notes       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  unique (spec_id, term)
);
comment on table public.study_spec_terms is
  '모집요강의 학기. 일정은 여기. 그 학기에 모집하는 학과·정원·오픈 여부는 study_offerings.';

-- 3. 요강↔항목 행을 학과 단위로
alter table public.study_spec_doc_items
  add column if not exists spec_department_id uuid references public.study_spec_departments(id) on delete cascade;
alter table public.study_spec_doc_items
  drop constraint if exists study_spec_doc_items_spec_id_item_key_key;
create unique index if not exists study_spec_doc_items_dept_item
  on public.study_spec_doc_items(spec_department_id, item_key) where spec_department_id is not null;
create index if not exists study_spec_doc_items_dept_idx on public.study_spec_doc_items(spec_department_id);

-- 4. 작성서류 양식을 요강 학과에
--    버전 묶음이 (대학, 종류, 요강 학과)가 된다. 학과에 복사하면 같은 파일을 가리키는 새 행이 생긴다.
alter table public.study_admission_form_files
  add column if not exists spec_department_id uuid references public.study_spec_departments(id) on delete set null;
create index if not exists study_admission_form_files_spec_dept_idx
  on public.study_admission_form_files(spec_department_id, is_current);
-- 옛 현행 유일 인덱스 (대학, department_name, 종류) 는 학과별 복사본과 충돌한다 → 학과 기준으로 교체.
--   (에디터에서 수동으로 만든 인덱스라 마이그레이션 파일에는 없다. 0066 실패의 원인이기도 하다.)
drop index if exists public.uniq_study_form_files_current;
create unique index if not exists uniq_study_form_files_current_dept
  on public.study_admission_form_files(university_id, key, spec_department_id)
  where is_current and spec_department_id is not null;

-- 5. 지원서에 학기
alter table public.study_applications
  add column if not exists term text;

-- 6. 요강 유일키: (대학, 학기, 전형, 과정) → 보관되지 않은 요강은 대학당 1개
alter table public.study_admission_specs
  drop constraint if exists study_admission_specs_unique_spec;
-- 합본(0067b) 전에는 대학당 여러 개가 남아 있으므로 인덱스는 0067b 끝에서 만든다.

-- 7. updated_at 트리거 · RLS (0060 과 같은 결)
do $do$
declare t text;
begin
  for t in select unnest(array['study_spec_departments','study_spec_terms']) loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_full', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_authenticated_full', t);
    execute format('drop policy if exists %I on public.%I', t || '_anon_read', t);
    execute format('create policy %I on public.%I for select to anon using (true)', t || '_anon_read', t);
  end loop;
end
$do$;

-- 확인
select
  to_regclass('public.study_spec_departments') is not null as has_spec_departments,
  to_regclass('public.study_spec_terms') is not null as has_spec_terms,
  exists (select 1 from information_schema.columns where table_name = 'study_spec_doc_items' and column_name = 'spec_department_id') as doc_items_has_dept,
  exists (select 1 from information_schema.columns where table_name = 'study_admission_form_files' and column_name = 'spec_department_id') as forms_has_dept,
  exists (select 1 from information_schema.columns where table_name = 'study_applications' and column_name = 'term') as apps_has_term;
