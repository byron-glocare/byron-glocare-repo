-- =============================================================================
-- 0071: 업로드 서류를 AI 가 읽은 결과 저장 (정보 입력 화면 자동 채움·차이 표시용)
--
-- 운영자 결정(2026-09-22): 업로드할 때마다 "바꿀래?" 묻지 않는다. 정보 입력 화면을 열면
--   아직 안 읽은 업로드 파일을 읽어 빈 칸은 채우고, 기존 값과 다른 칸은 그 칸 옆에 표시한다.
--   같은 파일을 매번 다시 읽지 않도록 파일(경로)별로 읽은 결과를 여기 둔다.
--   파일을 교체하면 경로가 바뀌므로 새 행이 생겨 다시 읽는다.
--
--   proposals: [{ key, value, display, confidence, source }]  (AI 가 읽은 값 — 카탈로그 키만)
--   dismissed_keys: 운영자가 "무시"한 키 — 그 파일의 그 값은 다시 표시하지 않는다.
-- 여러 번 돌려도 같다.
-- =============================================================================

create table if not exists public.study_student_doc_extractions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.study_managed_students(id) on delete cascade,
  file_path       text not null,
  doc_key         text,
  file_name       text,
  status          text not null default 'done' check (status in ('done', 'failed')),
  proposals       jsonb not null default '[]'::jsonb,
  dismissed_keys  text[] not null default '{}',
  error           text,
  extracted_at    timestamptz not null default timezone('utc', now()),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  unique (student_id, file_path)
);
create index if not exists study_student_doc_extractions_student_idx on public.study_student_doc_extractions(student_id);
comment on table public.study_student_doc_extractions is
  '업로드 서류 AI 읽기 결과(파일별). 정보 입력 화면에서 빈 칸 자동 채움과 기존 값과 다른 칸 표시에 쓴다.';

drop trigger if exists trg_study_student_doc_extractions_updated_at on public.study_student_doc_extractions;
create trigger trg_study_student_doc_extractions_updated_at
  before update on public.study_student_doc_extractions
  for each row execute function public.set_updated_at();

-- RLS: 읽기·쓰기는 서버(service role)에서만 한다. 로그인 사용자 직접 접근은 막는다.
alter table public.study_student_doc_extractions enable row level security;

-- 확인
select to_regclass('public.study_student_doc_extractions') is not null as has_table;
