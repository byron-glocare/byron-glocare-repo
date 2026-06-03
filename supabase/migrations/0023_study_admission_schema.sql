-- =============================================================================
-- 0023: 모집요강 + 양식 + 표준 데이터 스키마 (박제)
--
-- ⚠️ 이 테이블들은 이미 운영 Supabase 에 존재함 (이전 세션에서 SQL 에디터로
--    직접 생성, 마이그레이션 파일 누락). 이 파일은 **기록 + 신규 환경 재현용**.
--
-- 멱등(idempotent)으로 작성됨 — 이미 있으면 건너뛰므로 운영/신규 어디에
-- 붙여넣어도 에러 없이 안전하다. 단, 이미 존재하는 테이블의 컬럼은 변경하지
-- 않는다(create table if not exists 는 기존 테이블을 건드리지 않음).
--
-- 컬럼 구조는 src/types/database.ts 기준 복원. 관례(트리거·인덱스·timestamptz
-- 기본값·RLS)는 0009_study_abroad_schema.sql 을 따름.
--
-- ⚠️ RLS anon 정책은 운영 실제 정책을 읽을 수 없어 **베스트 게스**임. 학생 포털
--    (youstudyinkorea.com) / 유학센터 어드민 요구사항에 맞춰 검증·조정 필요.
--
-- 4개 테이블:
--   1. study_student_data_types   (표준 데이터 카탈로그)
--   2. study_admission_specs      (모집요강)
--   3. study_admission_form_files (입학 양식 파일 + 버전)
--   4. study_student_essay_drafts (AI 작문 초안)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. study_student_data_types — 학생 표준 데이터 카탈로그
-- -----------------------------------------------------------------------------
create table if not exists public.study_student_data_types (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,
  label_ko            text not null,
  label_vi            text not null,
  category            text not null
                        check (category in (
                          'identity','education','family','financial','language',
                          'contact','career','essay','document','other'
                        )),
  input_type          text not null
                        check (input_type in (
                          'text','long_text','date','number','select',
                          'multi_select','file','boolean'
                        )),
  options             jsonb,                              -- [{value,label_ko,label_vi}] | null
  hint_ko             text,
  hint_vi             text,
  is_essay_basis      boolean not null default false,
  is_default_required boolean not null default false,
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);
create index if not exists study_student_data_types_category_idx on public.study_student_data_types(category);
create index if not exists study_student_data_types_active_idx on public.study_student_data_types(is_active);

drop trigger if exists trg_study_student_data_types_updated_at on public.study_student_data_types;
create trigger trg_study_student_data_types_updated_at
  before update on public.study_student_data_types
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. study_admission_specs — 모집요강
-- -----------------------------------------------------------------------------
create table if not exists public.study_admission_specs (
  id                  uuid primary key default gen_random_uuid(),
  university_id       bigint not null references public.universities(id) on delete cascade,
  term                text not null,                      -- '2026-Spring' 등
  admission_category  text,
  program_type        text not null
                        check (program_type in (
                          'language_program','associate_2yr',
                          'bachelor_3yr_extension','bachelor_4yr'
                        )),
  status              text not null default 'draft'
                        check (status in ('draft','reviewing','approved','archived')),
  source_file_url     text,
  ai_extraction_log   jsonb,
  departments         jsonb not null default '[]'::jsonb, -- DepartmentItem[]
  required_documents  jsonb not null default '[]'::jsonb, -- RequiredDocument[]
  eligibility         jsonb not null default '{}'::jsonb, -- Eligibility
  schedule            jsonb not null default '{}'::jsonb, -- Schedule
  tuition             jsonb not null default '{}'::jsonb, -- Tuition
  scholarships        jsonb not null default '[]'::jsonb, -- Scholarship[]
  metadata            jsonb not null default '{}'::jsonb, -- Metadata
  approved_by         uuid references auth.users(id),
  approved_at         timestamptz,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);
create index if not exists study_admission_specs_university_idx on public.study_admission_specs(university_id);
create index if not exists study_admission_specs_status_idx on public.study_admission_specs(status);
create index if not exists study_admission_specs_updated_idx on public.study_admission_specs(updated_at desc);

drop trigger if exists trg_study_admission_specs_updated_at on public.study_admission_specs;
create trigger trg_study_admission_specs_updated_at
  before update on public.study_admission_specs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. study_admission_form_files — 입학 양식 파일 (대학 전체 / 학과별 override + 버전)
-- -----------------------------------------------------------------------------
create table if not exists public.study_admission_form_files (
  id                        uuid primary key default gen_random_uuid(),
  university_id             bigint not null references public.universities(id) on delete cascade,
  department_name           text,                         -- null = 대학 전체, 값 = 학과별 override
  key                       text not null
                              check (key in (
                                'application_form','self_intro','study_plan',
                                'financial_pledge_form','privacy_consent',
                                'academic_record_release','recommendation_letter',
                                'health_certificate','other'
                              )),
  name_ko                   text not null,
  file_url                  text not null,
  file_name                 text not null,
  size_bytes                bigint,
  mime_type                 text,
  is_current                boolean not null default true,
  superseded_by             uuid references public.study_admission_form_files(id) on delete set null,
  uploaded_by               uuid references auth.users(id),
  uploaded_at               timestamptz not null default timezone('utc', now()),
  notes                     text,
  required_data_type_keys   text[] not null default '{}', -- study_student_data_types.key 참조
  essay_questions           jsonb not null default '[]'::jsonb,
  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now())
);
create index if not exists study_admission_form_files_university_idx on public.study_admission_form_files(university_id);
create index if not exists study_admission_form_files_current_idx on public.study_admission_form_files(university_id, is_current);
create index if not exists study_admission_form_files_group_idx
  on public.study_admission_form_files(university_id, key, department_name);

drop trigger if exists trg_study_admission_form_files_updated_at on public.study_admission_form_files;
create trigger trg_study_admission_form_files_updated_at
  before update on public.study_admission_form_files
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. study_student_essay_drafts — AI 작문 초안 (서술형 질문별)
--    student_id 는 학생 식별자 (전용 students 테이블 없음 → FK 생략).
-- -----------------------------------------------------------------------------
create table if not exists public.study_student_essay_drafts (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null,
  form_file_id      uuid not null references public.study_admission_form_files(id) on delete cascade,
  question_index    integer not null,
  question_ko       text not null,
  basis_data_keys   text[] not null default '{}',
  generated_text    text,
  generated_at      timestamptz,
  generation_model  text,
  generation_usage  jsonb,
  edited_text       text,
  edited_at         timestamptz,
  edited_by         uuid references auth.users(id),
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);
create index if not exists study_student_essay_drafts_student_idx on public.study_student_essay_drafts(student_id);
create index if not exists study_student_essay_drafts_form_idx on public.study_student_essay_drafts(form_file_id);

drop trigger if exists trg_study_student_essay_drafts_updated_at on public.study_student_essay_drafts;
create trigger trg_study_student_essay_drafts_updated_at
  before update on public.study_student_essay_drafts
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS
--   - authenticated: 모든 테이블 풀 access (admin 전용) — 확실.
--   - anon: ⚠️ 베스트 게스. 운영 실제 정책 확인 후 조정 필요.
--   정책은 drop-if-exists 후 재생성 (멱등).
-- =============================================================================

alter table public.study_student_data_types    enable row level security;
alter table public.study_admission_specs        enable row level security;
alter table public.study_admission_form_files   enable row level security;
alter table public.study_student_essay_drafts   enable row level security;

-- 인증 사용자: 모든 테이블 풀 access
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'study_student_data_types','study_admission_specs',
      'study_admission_form_files','study_student_essay_drafts'
    ])
  loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_full', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_full', t
    );
  end loop;
end $$;

-- 익명 (학생 포털) — ⚠️ 베스트 게스, 운영 정책 검증 필요:
drop policy if exists study_student_data_types_anon_read on public.study_student_data_types;
create policy study_student_data_types_anon_read on public.study_student_data_types
  for select to anon using (is_active = true);

drop policy if exists study_admission_specs_anon_read on public.study_admission_specs;
create policy study_admission_specs_anon_read on public.study_admission_specs
  for select to anon using (status = 'approved');

drop policy if exists study_admission_form_files_anon_read on public.study_admission_form_files;
create policy study_admission_form_files_anon_read on public.study_admission_form_files
  for select to anon using (is_current = true);
-- study_student_essay_drafts 는 학생 개인 데이터 → anon 정책 없음 (의도적).

commit;
