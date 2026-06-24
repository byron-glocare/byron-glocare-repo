-- 0038: 이력서 작성 — 학생 공개 폼 token 기반 입력

create table if not exists public.resume_drafts (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  token           text not null unique,
  expires_at      timestamptz not null,
  submitted_at    timestamptz,
  -- 학생 입력 — 단일 jsonb. 필드:
  --   name_vi, name_kr, birth_date, phone, email, address, one_liner,
  --   narrative_raw, narrative_polished,
  --   educations: [{school, major, period, status}],
  --   careers: [{workplace, period, role, detail, status}],
  --   certifications: [{name, issuer, date}],
  --   skills: [{name, detail, level}],
  --   activities: [{name, period, org, detail}]
  data            jsonb not null default '{}'::jsonb,
  photo_path      text,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create index if not exists resume_drafts_customer_idx on public.resume_drafts(customer_id);
create index if not exists resume_drafts_token_idx on public.resume_drafts(token);

-- updated_at 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_resume_drafts_updated_at on public.resume_drafts;
create trigger trg_resume_drafts_updated_at
  before update on public.resume_drafts
  for each row execute function public.set_updated_at();

-- RLS — 관리자(authenticated) 전체 access. 공개 폼은 server action 이 service_role 로 우회.
alter table public.resume_drafts enable row level security;

drop policy if exists "resume_drafts_authenticated_all" on public.resume_drafts;
create policy "resume_drafts_authenticated_all"
  on public.resume_drafts
  for all
  to authenticated
  using (true)
  with check (true);
