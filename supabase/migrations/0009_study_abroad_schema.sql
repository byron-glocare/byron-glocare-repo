-- =============================================================================
-- 0009: 유학 도메인 — 7개 테이블
--
-- 유학생 홈페이지 (youstudyinkorea.com) 가 사용할 컨텐츠 + 폼 데이터.
-- 기존 GLOCARE_DB Google Drive 시트를 Supabase 로 이전.
--
-- 도메인 격리: 명시적으로 study_ prefix (centers/cases/contacts/channels 등은
-- 너무 generic 해서 다른 도메인과 충돌 가능). universities / departments 는
-- 명백히 유학 도메인 어휘라 prefix 생략.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. universities (대학 마스터)
-- -----------------------------------------------------------------------------
create table public.universities (
  id                bigserial primary key,
  active            boolean not null default true,
  name_ko           text not null,
  name_vi           text,
  region_ko         text,
  region_vi         text,
  logo_url          text,
  photo_url         text,
  website_url       text,
  desc_ko           text,
  desc_vi           text,
  class_days_ko     text,
  class_days_vi     text,
  transport_bus     boolean not null default false,
  transport_subway  boolean not null default false,
  transport_train   boolean not null default false,
  transport_desc_ko text,
  transport_desc_vi text,
  dormitory         boolean not null default false,
  dormitory_desc_ko text,
  dormitory_desc_vi text,
  -- 강점/태그/카테고리 — 쉼표 구분 문자열 (홈페이지 필터링 키)
  strengths         text,
  tags_ko           text,
  tags_vi           text,
  categories        text,
  emoji             text,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);
create index universities_active_idx on public.universities(active);

create trigger trg_universities_updated_at
  before update on public.universities
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. departments (학과)
-- -----------------------------------------------------------------------------
create table public.departments (
  id              bigserial primary key,
  university_id   bigint not null references public.universities(id) on delete cascade,
  active          boolean not null default true,
  icon            text,
  name_ko         text not null,
  name_vi         text,
  category        text,
  degree_years    integer,
  tuition_ko      text,
  tuition_vi      text,
  scholarship_ko  text,
  scholarship_vi  text,
  dept_url        text,
  badge           text,                          -- 'hot' / 'new' / etc
  case_ids        text,                          -- 쉼표 구분 study_cases.id 참조
  course          text,                          -- direct / credit / 등
  sort_order      integer not null default 0,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);
create index departments_university_idx on public.departments(university_id);
create index departments_active_idx on public.departments(active);

create trigger trg_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. study_centers (베트남 협력 유학센터)
-- -----------------------------------------------------------------------------
create table public.study_centers (
  id            bigserial primary key,
  active        boolean not null default true,
  flag          text,                            -- 🇻🇳 등 이모지
  name_ko       text,
  name_vi       text not null,
  city_ko       text,
  city_vi       text,
  address       text,
  phone         text,
  email         text,
  desc_ko       text,
  desc_vi       text,
  students_ko   text,
  students_vi   text,
  years_ko      text,
  years_vi      text,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);
create index study_centers_active_idx on public.study_centers(active);

create trigger trg_study_centers_updated_at
  before update on public.study_centers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. study_cases (취업 사례)
-- -----------------------------------------------------------------------------
create table public.study_cases (
  id            bigserial primary key,
  active        boolean not null default true,
  tiktok_url    text,
  tiktok_thumb  text,
  hero          boolean not null default false, -- 메인 노출 우선순위
  category_ko   text,
  category_vi   text,
  title_ko      text,
  title_vi      text,
  desc_ko       text,
  desc_vi       text,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);
create index study_cases_active_idx on public.study_cases(active);

create trigger trg_study_cases_updated_at
  before update on public.study_cases
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. study_contacts (상담 신청 폼)
-- -----------------------------------------------------------------------------
create table public.study_contacts (
  id            bigserial primary key,
  submitted_at  timestamptz not null default timezone('utc', now()),
  name          text,
  phone         text,
  email         text,
  age           integer,
  dept          text,            -- 희망 학과 (자유 텍스트 또는 department key)
  center        text,            -- 추천 받은 센터명
  recruiting    text,            -- 'Y' / 'N' — 모집인지 여부
  message       text,
  status        text not null default '미확인'
                check (status in ('미확인','연락완료','등록완료')),
  memo          text
);
create index study_contacts_status_idx on public.study_contacts(status);
create index study_contacts_submitted_idx on public.study_contacts(submitted_at desc);

-- -----------------------------------------------------------------------------
-- 6. study_channels (SNS 채널)
-- -----------------------------------------------------------------------------
create table public.study_channels (
  id          bigserial primary key,
  active      boolean not null default true,
  type        text check (type in
                ('tiktok','facebook','instagram','youtube','website','kakao','zalo','other')),
  icon        text,
  name_ko     text,
  name_vi     text,
  desc_ko     text,
  desc_vi     text,
  handle      text,
  url         text,
  sort_order  integer not null default 0,
  memo        text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);
create index study_channels_active_idx on public.study_channels(active);

create trigger trg_study_channels_updated_at
  before update on public.study_channels
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. study_insurance_claims (유학생 보험 신청 폼)
-- -----------------------------------------------------------------------------
create table public.study_insurance_claims (
  id            bigserial primary key,
  submitted_at  timestamptz not null default timezone('utc', now()),
  name          text,
  alien_no      text,            -- 외국인등록번호
  zalo          text,
  marketing     text,            -- 'Y' / 'N' — 마케팅 수신 동의
  status        text not null default '미확인'
                check (status in ('미확인','연락완료','등록완료')),
  memo          text
);
create index study_insurance_status_idx on public.study_insurance_claims(status);
create index study_insurance_submitted_idx on public.study_insurance_claims(submitted_at desc);

-- =============================================================================
-- RLS 정책
--   - 익명(anon): 컨텐츠 테이블 read-only (active=true), 폼 테이블 insert-only
--   - 인증(authenticated): 모든 테이블 풀 access (admin 전용)
-- =============================================================================

alter table public.universities          enable row level security;
alter table public.departments           enable row level security;
alter table public.study_centers         enable row level security;
alter table public.study_cases           enable row level security;
alter table public.study_contacts        enable row level security;
alter table public.study_channels        enable row level security;
alter table public.study_insurance_claims enable row level security;

-- 인증 사용자: 모든 테이블 풀 access
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'universities','departments','study_centers','study_cases',
      'study_contacts','study_channels','study_insurance_claims'
    ])
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_full', t
    );
  end loop;
end $$;

-- 익명: 컨텐츠 4종 (active=true 만) read
create policy universities_anon_read on public.universities
  for select to anon using (active = true);
create policy departments_anon_read on public.departments
  for select to anon using (active = true);
create policy study_centers_anon_read on public.study_centers
  for select to anon using (active = true);
create policy study_cases_anon_read on public.study_cases
  for select to anon using (active = true);
create policy study_channels_anon_read on public.study_channels
  for select to anon using (active = true);

-- 익명: 폼 2종 insert 만
create policy study_contacts_anon_insert on public.study_contacts
  for insert to anon with check (true);
create policy study_insurance_anon_insert on public.study_insurance_claims
  for insert to anon with check (true);

commit;
