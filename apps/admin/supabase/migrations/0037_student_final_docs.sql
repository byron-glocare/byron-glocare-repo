-- =============================================================================
-- 0037: 확정 작성서류 저장 테이블 (study_student_final_docs)
--
-- 유학센터가 작성서류를 "확정"하면 그 시점에 채운 PDF 를 생성해 스토리지
-- (student-files 비공개 버킷)에 저장하고, 이 테이블에 1건 기록한다.
--   - 매번 동적 생성하던 것을 확정 시 1회 생성·저장 → 다운로드 빠름
--   - admin(유학생 상세)에서 확정본 다운로드
--
-- 경로 규칙: {org_id}/{student_id}/final/{form_file_id}_{application_id}.pdf
-- 재확정(다시 확정) 시 같은 경로 덮어쓰기(upsert) + 이 row 갱신.
-- =============================================================================

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

create index if not exists idx_final_docs_student on public.study_student_final_docs(student_id);

-- updated_at 트리거 (기존 study_touch_updated_at 재사용)
drop trigger if exists trg_final_docs_updated on public.study_student_final_docs;
create trigger trg_final_docs_updated
  before update on public.study_student_final_docs
  for each row execute function public.study_touch_updated_at();

-- RLS
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
