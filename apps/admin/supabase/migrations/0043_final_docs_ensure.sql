-- =============================================================================
-- 0043: study_student_final_docs 존재 보장 + submitted 컬럼 + 스키마캐시 리로드
--
-- 증상: "Could not find the table 'public.study_student_final_docs' in the
--       schema cache" — 테이블이 없거나(0037 미실행) PostgREST 캐시 미갱신.
-- 이 스크립트는 멱등 — 이미 있으면 데이터/정책 변화 없이 통과한다.
-- =============================================================================

-- 1) 테이블 (0037 과 동일. 있으면 no-op)
create table if not exists public.study_student_final_docs (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.study_managed_students(id) on delete cascade,
  form_file_id   uuid not null references public.study_admission_form_files(id) on delete cascade,
  application_id uuid not null references public.study_applications(id) on delete cascade,
  doc_name       text not null,
  file_path      text not null,
  file_name      text not null,
  size_bytes     integer,
  finalized_by   uuid references auth.users(id) on delete set null,
  finalized_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, form_file_id, application_id)
);

-- 2) 최종 제출 컬럼 (0042)
alter table public.study_student_final_docs
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

create index if not exists idx_final_docs_student   on public.study_student_final_docs(student_id);
create index if not exists idx_final_docs_submitted on public.study_student_final_docs(submitted_at);

-- 3) updated_at 트리거
drop trigger if exists trg_final_docs_updated on public.study_student_final_docs;
create trigger trg_final_docs_updated
  before update on public.study_student_final_docs
  for each row execute function public.study_touch_updated_at();

-- 4) RLS (0037 과 동일 정의 — 재적용해도 동일하므로 보안 변화 없음)
alter table public.study_student_final_docs enable row level security;

drop policy if exists final_docs_admin_all on public.study_student_final_docs;
create policy final_docs_admin_all on public.study_student_final_docs
  for all to authenticated
  using (public.study_is_glocare_admin())
  with check (public.study_is_glocare_admin());

drop policy if exists final_docs_org_member on public.study_student_final_docs;
create policy final_docs_org_member on public.study_student_final_docs
  for all to authenticated
  using (
    student_id in (
      select id from public.study_managed_students
      where org_id in (select public.study_my_org_ids())
    )
  )
  with check (
    student_id in (
      select id from public.study_managed_students
      where org_id in (select public.study_my_org_ids())
    )
  );

-- 5) PostgREST 스키마 캐시 즉시 리로드
notify pgrst, 'reload schema';
