-- =============================================================================
-- 0011_caregiver_homepage_schema.sql
--
-- 요양보호사 홈페이지 (glocare-homepage-caregiver) 신규 도메인.
-- 기존 admin/유학 도메인과 분리.
--
-- 추가:
--   1. customers.auth_user_id   — Supabase Auth 와 매핑
--   2. videos                   — Vimeo 영상 마스터
--   3. video_views              — 시청 기록
--   4. cbt_questions            — 요양보호사 CBT 문제 (1721개)
--   5. cbt_attempts             — 응시 기록
--   6. resumes                  — AI 이력서
--   7. ambassador_config        — 엠버서더 단일 설정 row
--   8. caregiver_contacts       — 폼 (교육신청 / 제휴문의 / 일반문의)
--
--   + 자동 매핑 트리거 (양방향)
--   + RLS 정책
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. customers.auth_user_id (admin DB 의 customers 테이블에 컬럼 추가)
-- -----------------------------------------------------------------------------
alter table public.customers
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists customers_auth_user_idx on public.customers(auth_user_id);
create index if not exists customers_email_idx on public.customers(email);
create index if not exists customers_phone_idx on public.customers(phone);

-- -----------------------------------------------------------------------------
-- 2. videos
-- -----------------------------------------------------------------------------
create table public.videos (
  id              bigserial primary key,
  active          boolean not null default true,
  vimeo_id        text not null,                  -- 예: '123456789'
  title_ko        text, title_vi text,
  desc_ko         text, desc_vi text,
  tags            text[] not null default '{}',   -- ['요양', '식사보조', ...]
  duration_seconds integer,
  thumbnail_url   text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);
create index videos_active_idx on public.videos(active);
create trigger trg_videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. video_views
-- -----------------------------------------------------------------------------
create table public.video_views (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  video_id    bigint not null references public.videos(id) on delete cascade,
  watched_at  timestamptz not null default timezone('utc', now()),
  unique (user_id, video_id)
);
create index video_views_user_idx on public.video_views(user_id);

-- -----------------------------------------------------------------------------
-- 4. cbt_questions
-- -----------------------------------------------------------------------------
create table public.cbt_questions (
  id                    integer primary key,        -- 원본 문제번호
  active                boolean not null default true,
  chapter               text not null,              -- '1' ~ '15' or 'mock'
  question              text not null,
  choices               jsonb not null,             -- ['보기1', '보기2', '보기3', '보기4', '보기5']
  answer_index          integer not null,           -- 1~5
  intent_ko             text, intent_vi text,
  choice_explanations   jsonb,                      -- {1: '한·베', ...}
  key_terms             jsonb,                      -- [{term_ko, term_vi, def_ko, def_vi}, ...]
  created_at            timestamptz not null default timezone('utc', now())
);
create index cbt_questions_chapter_idx on public.cbt_questions(chapter);
create index cbt_questions_active_idx on public.cbt_questions(active);

-- -----------------------------------------------------------------------------
-- 5. cbt_attempts
-- -----------------------------------------------------------------------------
create table public.cbt_attempts (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  started_at      timestamptz not null default timezone('utc', now()),
  finished_at     timestamptz,
  question_ids    integer[] not null,
  answers         jsonb not null default '{}'::jsonb,
  score           integer,
  total           integer not null default 30,
  chapter_filter  text
);
create index cbt_attempts_user_idx on public.cbt_attempts(user_id);

-- -----------------------------------------------------------------------------
-- 6. resumes
-- -----------------------------------------------------------------------------
create table public.resumes (
  id                  bigserial primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  -- 입력 raw
  agree_terms         boolean not null default false,
  name_vi             text, name_ko text,
  birth_date          date,
  phone               text,
  email               text,
  address_ko          text,
  education_raw       text,
  experience_raw      text,
  certificates_raw    text,
  skills_raw          text,
  activities_raw      text,
  motto               text,
  episode             text,
  photo_url           text,
  -- AI 정리
  ai_education        jsonb,
  ai_experience       jsonb,
  ai_certificates     jsonb,
  ai_skills           jsonb,
  ai_activities       jsonb,
  ai_self_intro       text,
  -- 출력
  pdf_url             text,
  status              text not null default 'draft',  -- 'draft' / 'generating' / 'ready' / 'failed'
  generated_at        timestamptz,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);
create index resumes_user_idx on public.resumes(user_id);
create trigger trg_resumes_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. ambassador_config (single-row)
-- -----------------------------------------------------------------------------
create table public.ambassador_config (
  id            integer primary key default 1 check (id = 1),
  entry_code    text,                              -- 4-8자리
  kakao_qr_url  text,                              -- '/kakao-qr.png'
  benefits_ko   text, benefits_vi text,
  updated_at    timestamptz not null default timezone('utc', now())
);
insert into public.ambassador_config (id) values (1) on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 8. caregiver_contacts (홈페이지 폼 통합)
-- -----------------------------------------------------------------------------
create table public.caregiver_contacts (
  id              bigserial primary key,
  submitted_at    timestamptz not null default timezone('utc', now()),
  kind            text not null,                   -- 'consultation' / 'training_signup' / 'partnership'
  name            text not null,
  phone           text,
  email           text,
  message         text,
  status          text not null default '미확인',
  memo            text,
  auth_user_id    uuid references auth.users(id) on delete set null,
  -- training_signup 의 추가 필드 (위 명세상 customers 로 직접 들어가지만 백업 + 읽기 편의)
  region          text,
  topik_level     text,
  visa_type       text,
  -- partnership 의 추가
  company         text
);
create index caregiver_contacts_status_idx on public.caregiver_contacts(status);
create index caregiver_contacts_kind_idx on public.caregiver_contacts(kind);

-- =============================================================================
-- 자동 매핑 트리거 — auth.users <-> customers
-- =============================================================================

-- (a) auth.users INSERT 시: email 또는 phone 일치하는 unmapped customer 찾아 link
create or replace function public.try_map_auth_to_customer()
returns trigger language plpgsql security definer as $$
declare
  match_id text;
begin
  if new.email is null then return new; end if;

  -- email 우선 매칭
  select id into match_id
  from public.customers
  where email = new.email
    and auth_user_id is null
  limit 1;

  -- email 매칭 실패 시 phone (raw_user_meta_data 의 phone 필드)
  if match_id is null and new.raw_user_meta_data->>'phone' is not null then
    select id into match_id
    from public.customers
    where phone = new.raw_user_meta_data->>'phone'
      and auth_user_id is null
    limit 1;
  end if;

  if match_id is not null then
    update public.customers set auth_user_id = new.id where id = match_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_to_customer on auth.users;
create trigger trg_auth_user_to_customer
  after insert on auth.users
  for each row execute function public.try_map_auth_to_customer();

-- (b) customers INSERT/UPDATE 시: email/phone 일치하는 unmapped auth user 찾아 link
create or replace function public.try_map_customer_to_auth()
returns trigger language plpgsql security definer as $$
declare
  match_uid uuid;
begin
  -- 이미 매핑 됐으면 skip
  if new.auth_user_id is not null then return new; end if;

  if new.email is null and new.phone is null then return new; end if;

  -- email 우선
  if new.email is not null then
    select id into match_uid
    from auth.users
    where email = new.email
      and id not in (select auth_user_id from public.customers where auth_user_id is not null)
    limit 1;
  end if;

  -- phone fallback
  if match_uid is null and new.phone is not null then
    select id into match_uid
    from auth.users
    where raw_user_meta_data->>'phone' = new.phone
      and id not in (select auth_user_id from public.customers where auth_user_id is not null)
    limit 1;
  end if;

  if match_uid is not null then
    new.auth_user_id := match_uid;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_customer_to_auth on public.customers;
create trigger trg_customer_to_auth
  before insert or update of email, phone on public.customers
  for each row execute function public.try_map_customer_to_auth();

-- =============================================================================
-- RLS 정책
-- =============================================================================

alter table public.videos                enable row level security;
alter table public.video_views           enable row level security;
alter table public.cbt_questions         enable row level security;
alter table public.cbt_attempts          enable row level security;
alter table public.resumes               enable row level security;
alter table public.ambassador_config     enable row level security;
alter table public.caregiver_contacts    enable row level security;

-- (a) authenticated 풀 액세스 (admin)
do $$ declare t text;
begin
  for t in select unnest(array['videos','video_views','cbt_questions','cbt_attempts','resumes','ambassador_config','caregiver_contacts']) loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- (b) anon read — public 데이터 (active 만)
create policy videos_anon_read on public.videos
  for select to anon using (active = true);
create policy cbt_questions_anon_read on public.cbt_questions
  for select to anon using (active = true);
create policy ambassador_config_anon_read on public.ambassador_config
  for select to anon using (true);

-- (c) anon insert (폼)
create policy caregiver_contacts_anon_insert on public.caregiver_contacts
  for insert to anon with check (true);

-- (d) 본인 데이터만 — video_views, cbt_attempts, resumes
-- 로그인 사용자(authenticated) 정책으로 위에서 풀 액세스 부여했으나
-- 추후 user_id = auth.uid() 로 좁힐 수 있음. 현재는 단순화.

-- =============================================================================
-- Storage 버킷 (이력서 사진 + PDF)
-- =============================================================================
-- Supabase Studio 에서 직접 생성:
--   - 'resume-photos' (private)
--   - 'resume-pdfs'   (private)
--
-- 또는 SQL:
-- insert into storage.buckets (id, name, public) values
--   ('resume-photos', 'resume-photos', false),
--   ('resume-pdfs',   'resume-pdfs',   false)
-- on conflict do nothing;
