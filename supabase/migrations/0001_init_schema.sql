-- =============================================================================
-- Glocare 교육생 관리 시스템 — 초기 스키마
-- 개발지시서 v1.2 §4 기준
-- =============================================================================
-- 적용 방법:
--   Supabase Dashboard > SQL Editor > New query > 이 파일 전체 붙여넣기 > Run
-- =============================================================================

-- 확장: gen_random_uuid() 는 PG13+ 내장. 명시적으로 활성화.
create extension if not exists "pgcrypto";

-- =============================================================================
-- 공통 트리거 함수 — updated_at 자동 갱신
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- =============================================================================
-- 1. status_options — 기존 엑셀 상태값 (편집 가능)
-- =============================================================================
create table public.status_options (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  label         text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create trigger trg_status_options_updated_at
  before update on public.status_options
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 2. training_centers — 교육원
-- =============================================================================
create table public.training_centers (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,
  name                text not null,
  region              text,
  address             text,
  business_number     text,
  director_name       text,
  phone               text,
  email               text,
  bank_name           text,
  bank_account        text,
  tuition_fee_2025    numeric,
  tuition_fee_2026    numeric,
  class_hours         text,
  naeil_card_eligible boolean default false,
  contract_status     text,
  notes               text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create trigger trg_training_centers_updated_at
  before update on public.training_centers
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. training_classes — 교육원 월별 개강 정보
-- =============================================================================
create table public.training_classes (
  id                  uuid primary key default gen_random_uuid(),
  training_center_id  uuid not null references public.training_centers(id) on delete cascade,
  year                integer not null,
  month               integer not null check (month between 1 and 12),
  class_type          text not null check (class_type in ('weekday', 'night')),
  start_date          date,
  end_date            date,
  notes               text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create trigger trg_training_classes_updated_at
  before update on public.training_classes
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 4. care_homes — 요양원
-- =============================================================================
create table public.care_homes (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,
  name                text not null,
  region              text,
  address             text,
  director_name       text,
  phone               text,
  contact_person      text,
  contact_phone       text,
  bed_capacity        text,
  partnership_notes   text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create trigger trg_care_homes_updated_at
  before update on public.care_homes
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 5. customers — 교육생
-- =============================================================================
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  legacy_status       text,

  -- 개인정보
  name_vi             text,
  name_kr             text,
  address             text,
  gender              text check (gender in ('남', '여') or gender is null),
  birth_year          integer,
  phone               text,
  email               text,

  -- 비자
  visa_type           text,
  topik_level         text,
  stay_remaining      text,

  -- 희망 교육 조건
  desired_period      text,
  desired_time        text check (desired_time in ('주간', '야간') or desired_time is null),
  desired_region      text,

  -- 매칭
  training_center_id  uuid references public.training_centers(id) on delete set null,
  training_class_id   uuid references public.training_classes(id) on delete set null,
  care_home_id        uuid references public.care_homes(id) on delete set null,

  -- 일정
  class_start_date    date,
  class_end_date      date,
  work_start_date     date,
  work_end_date       date,
  visa_change_date    date,
  interview_date      date,

  -- 상품
  product_type        text check (
    product_type in ('교육', '웰컴팩', '교육+웰컴팩') or product_type is null
  ),

  -- 대기
  is_waiting          boolean not null default false,
  recontact_date      date,
  waiting_memo        text check (waiting_memo is null or char_length(waiting_memo) <= 500),

  -- 종료
  termination_reason  text check (
    termination_reason in ('요양보호사 직종변경', '귀국', '연락두절') or termination_reason is null
  ),

  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 6. customer_statuses — 진행 단계 체크 (1:1 with customers)
-- =============================================================================
create table public.customer_statuses (
  customer_id                    uuid primary key references public.customers(id) on delete cascade,

  -- 접수
  intake_abandoned               boolean not null default false,
  study_abroad_consultation      boolean not null default false,

  -- 교육 예약
  training_center_finding        boolean not null default false,
  training_reservation_abandoned boolean not null default false,

  -- 교육
  certificate_acquired           boolean not null default false,
  training_dropped               boolean not null default false,

  -- 취업
  welcome_pack_abandoned         boolean not null default false,
  care_home_finding              boolean not null default false,
  interview_passed               boolean not null default false,

  updated_at                     timestamptz not null default timezone('utc', now())
);

create trigger trg_customer_statuses_updated_at
  before update on public.customer_statuses
  for each row execute function public.set_updated_at();

-- 신규 customer 생성 시 customer_statuses 레코드 자동 생성
create or replace function public.create_customer_status()
returns trigger
language plpgsql
as $$
begin
  insert into public.customer_statuses (customer_id) values (new.id)
  on conflict (customer_id) do nothing;
  return new;
end;
$$;

create trigger trg_customer_create_status
  after insert on public.customers
  for each row execute function public.create_customer_status();

-- =============================================================================
-- 7. customer_consultations — 상담 일지 (누적, 삭제 불가)
-- =============================================================================
create table public.customer_consultations (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers(id) on delete cascade,
  consultation_type text not null check (consultation_type in ('training_center', 'care_home')),
  content_vi        text,
  content_kr        text,
  author_id         uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default timezone('utc', now())
);

-- =============================================================================
-- 8. reservation_payments — 예약 결제
-- =============================================================================
create table public.reservation_payments (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  amount          integer not null,
  payment_date    date,
  refund_amount   integer not null default 0,
  refund_date     date,
  refund_reason   text check (
    refund_reason in (
      '중도탈락_매출인식',
      '교육생환급_공제없음',
      '소개비_공제',
      '교육원섭외실패_환불'
    ) or refund_reason is null
  ),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create trigger trg_reservation_payments_updated_at
  before update on public.reservation_payments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 9. commission_payments — 소개비 결제
-- =============================================================================
create table public.commission_payments (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers(id) on delete cascade,
  training_center_id  uuid not null references public.training_centers(id) on delete restrict,
  total_amount        integer not null,
  deduction_amount    integer not null default 0,
  received_amount     integer,
  received_date       date,
  tax_invoice_issued  boolean not null default false,
  tax_invoice_date    date,
  sms_sent_at         timestamptz,
  status              text not null default 'pending' check (
    status in ('pending', 'notified', 'completed')
  ),
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create trigger trg_commission_payments_updated_at
  before update on public.commission_payments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 10. event_payments — 이벤트 결제
-- =============================================================================
create table public.event_payments (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers(id) on delete cascade,
  event_type          text not null,
  amount              integer not null default 0,
  gift_type           text,
  friend_customer_id  uuid references public.customers(id) on delete set null,
  gift_given          boolean not null default false,
  gift_given_date     date,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create trigger trg_event_payments_updated_at
  before update on public.event_payments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 11. welcome_pack_payments — 웰컴팩 결제 (3회차 분할)
-- =============================================================================
create table public.welcome_pack_payments (
  id                     uuid primary key default gen_random_uuid(),
  customer_id            uuid not null unique references public.customers(id) on delete cascade,
  total_price            integer not null default 1500000,
  discount_amount        integer not null default 0,
  final_amount           integer generated always as (total_price - discount_amount) stored,

  reservation_amount     integer not null default 0,
  reservation_date       date,

  interim_amount         integer not null default 0,
  interim_date           date,

  balance_amount         integer not null default 0,
  balance_date           date,

  sales_reported         boolean not null default false,
  sales_reported_date    date,

  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now())
);

create trigger trg_welcome_pack_payments_updated_at
  before update on public.welcome_pack_payments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 12. sms_messages — SMS 발송 이력
-- =============================================================================
create table public.sms_messages (
  id                  uuid primary key default gen_random_uuid(),
  message_type        text not null,
  target_customer_id  uuid references public.customers(id) on delete set null,
  target_center_id    uuid references public.training_centers(id) on delete set null,
  content             text not null,
  sent_at             timestamptz not null default timezone('utc', now()),
  sent_by             uuid references auth.users(id) on delete set null
);

-- =============================================================================
-- 13. system_settings — 시스템 설정 (key/value)
-- =============================================================================
create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default timezone('utc', now()),
  updated_by  uuid references auth.users(id) on delete set null
);

create trigger trg_system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 인덱스
-- =============================================================================
-- customers
create index idx_customers_training_center_id on public.customers(training_center_id);
create index idx_customers_training_class_id on public.customers(training_class_id);
create index idx_customers_care_home_id on public.customers(care_home_id);
create index idx_customers_is_waiting on public.customers(is_waiting) where is_waiting = true;
create index idx_customers_termination on public.customers(termination_reason) where termination_reason is not null;
create index idx_customers_legacy_status on public.customers(legacy_status);

-- consultations
create index idx_consultations_customer_id on public.customer_consultations(customer_id);
create index idx_consultations_created_at on public.customer_consultations(created_at desc);

-- payments
create index idx_reservation_customer_id on public.reservation_payments(customer_id);
create index idx_commission_customer_id on public.commission_payments(customer_id);
create index idx_commission_center_id on public.commission_payments(training_center_id);
create index idx_commission_status on public.commission_payments(status);
create index idx_event_customer_id on public.event_payments(customer_id);
create index idx_event_friend_id on public.event_payments(friend_customer_id);
create index idx_welcome_customer_id on public.welcome_pack_payments(customer_id);

-- training_classes
create index idx_training_classes_center_period
  on public.training_classes(training_center_id, year, month);

-- sms
create index idx_sms_target_customer on public.sms_messages(target_customer_id);
create index idx_sms_target_center on public.sms_messages(target_center_id);
create index idx_sms_message_type on public.sms_messages(message_type);

-- =============================================================================
-- Row Level Security
-- 정책: 인증된 사용자(auth.uid() IS NOT NULL)는 전체 CRUD 가능.
-- =============================================================================
alter table public.status_options          enable row level security;
alter table public.training_centers        enable row level security;
alter table public.training_classes        enable row level security;
alter table public.care_homes              enable row level security;
alter table public.customers               enable row level security;
alter table public.customer_statuses       enable row level security;
alter table public.customer_consultations  enable row level security;
alter table public.reservation_payments    enable row level security;
alter table public.commission_payments     enable row level security;
alter table public.event_payments          enable row level security;
alter table public.welcome_pack_payments   enable row level security;
alter table public.sms_messages            enable row level security;
alter table public.system_settings         enable row level security;

-- 헬퍼 매크로 대신 인라인으로 모든 테이블에 동일 정책 부여
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'status_options',
      'training_centers',
      'training_classes',
      'care_homes',
      'customers',
      'customer_statuses',
      'customer_consultations',
      'reservation_payments',
      'commission_payments',
      'event_payments',
      'welcome_pack_payments',
      'sms_messages',
      'system_settings'
    ])
  loop
    execute format(
      'create policy "authenticated_full_access" on public.%I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      t
    );
  end loop;
end;
$$;
