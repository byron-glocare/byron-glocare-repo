-- =============================================================================
-- 0024: 유학 B2B 정산 스키마 (박제)
--
-- ⚠️ 이 테이블들은 이미 운영 Supabase 에 존재함 (이전 세션에서 SQL 에디터로
--    직접 생성, 마이그레이션 파일 누락). 이 파일은 **기록 + 신규 환경 재현용**.
--
-- 멱등(idempotent)으로 작성됨 — create table/index if not exists,
-- trigger·policy 는 drop-if-exists 후 재생성. 단 ⚠️ 운영 DB 에는 실행하지 말 것:
-- 테이블은 이미 있어 건너뛰지만 RLS 정책 재생성이 운영 보안을 바꿀 수 있음.
-- 신규/빈 프로젝트에서만 실행.
--
-- 컬럼 구조는 src/types/database.ts 기준 복원. 금액(numeric)·기간(date)·일시
-- (timestamptz) 타입은 타입 정보상 구분 불가하여 의미 기반 추정.
--
-- 내부 재무 데이터 → anon 접근 없음 (authenticated 전용).
--
-- 4개 테이블:
--   1. study_pricing_plans  (가격 플랜)
--   2. study_center_orgs    (유학센터 회사)
--   3. study_invoices       (인보이스)
--   4. study_settlements    (입금/정산)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. study_pricing_plans — 가격 플랜
-- -----------------------------------------------------------------------------
create table if not exists public.study_pricing_plans (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  model             text not null
                      check (model in ('per_student','monthly','percentage','hybrid')),
  currency          text not null,
  per_student_fee   numeric,
  monthly_fee       numeric,
  percentage_rate   numeric,
  percentage_basis  text check (percentage_basis in ('tuition','total_paid')),
  hybrid_params     jsonb,
  notes             text,
  is_active         boolean not null default true,
  effective_from    date,
  effective_to      date,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);
create index if not exists study_pricing_plans_active_idx on public.study_pricing_plans(is_active);

drop trigger if exists trg_study_pricing_plans_updated_at on public.study_pricing_plans;
create trigger trg_study_pricing_plans_updated_at
  before update on public.study_pricing_plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. study_center_orgs — 유학센터 회사 (B2B 고객사)
-- -----------------------------------------------------------------------------
create table if not exists public.study_center_orgs (
  id                  uuid primary key default gen_random_uuid(),
  name_vi             text not null,
  name_ko             text,
  country             text not null,
  tax_id              text,
  status              text not null default 'pending'
                        check (status in ('pending','active','suspended','closed')),
  pricing_plan_id     uuid references public.study_pricing_plans(id),
  settlement_currency text not null,
  contact_info        jsonb,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),
  activated_at        timestamptz,
  deactivated_at      timestamptz
);
create index if not exists study_center_orgs_status_idx on public.study_center_orgs(status);
create index if not exists study_center_orgs_plan_idx on public.study_center_orgs(pricing_plan_id);

drop trigger if exists trg_study_center_orgs_updated_at on public.study_center_orgs;
create trigger trg_study_center_orgs_updated_at
  before update on public.study_center_orgs
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. study_invoices — 인보이스
-- -----------------------------------------------------------------------------
create table if not exists public.study_invoices (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.study_center_orgs(id) on delete restrict,
  period_start      date not null,
  period_end        date not null,
  line_items        jsonb not null default '[]'::jsonb,
  total_amount      numeric not null default 0,
  currency          text not null,
  status            text not null default 'draft'
                      check (status in ('draft','sent','paid','cancelled')),
  tax_invoice_url   text,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  sent_at           timestamptz,
  paid_at           timestamptz
);
create index if not exists study_invoices_org_idx on public.study_invoices(org_id);
create index if not exists study_invoices_status_idx on public.study_invoices(status);
create index if not exists study_invoices_period_idx on public.study_invoices(period_start, period_end);

drop trigger if exists trg_study_invoices_updated_at on public.study_invoices;
create trigger trg_study_invoices_updated_at
  before update on public.study_invoices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. study_settlements — 입금/정산 (인보이스에 매칭). Row 에 updated_at 없음 → 트리거 없음.
-- -----------------------------------------------------------------------------
create table if not exists public.study_settlements (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null references public.study_invoices(id) on delete restrict,
  amount              numeric not null,
  currency            text not null,
  received_at         timestamptz not null default timezone('utc', now()),
  bank_reference      text,
  attached_proof_url  text,
  matched_by_admin    uuid references auth.users(id),
  note                text,
  created_at          timestamptz not null default timezone('utc', now())
);
create index if not exists study_settlements_invoice_idx on public.study_settlements(invoice_id);
create index if not exists study_settlements_received_idx on public.study_settlements(received_at desc);

-- =============================================================================
-- RLS — 내부 재무 데이터. authenticated 전용 (anon 없음). 정책은 drop-if-exists 후 재생성.
-- =============================================================================

alter table public.study_pricing_plans enable row level security;
alter table public.study_center_orgs   enable row level security;
alter table public.study_invoices       enable row level security;
alter table public.study_settlements    enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'study_pricing_plans','study_center_orgs','study_invoices','study_settlements'
    ])
  loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_full', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_full', t
    );
  end loop;
end $$;

commit;
