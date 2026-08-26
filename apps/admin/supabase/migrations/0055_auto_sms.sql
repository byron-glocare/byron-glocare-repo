-- =============================================================================
-- 0055: 자동 문자 발송 (auto_sms_rules / auto_sms_sends)
--
-- 교육생 생애주기 날짜(가입일·교육 시작일·취업일 등)를 기준으로 자동으로
-- MMS 문자를 발송하는 룰 시스템.
--   - 룰 = 이름(내부용) + 제목(MMS title) + 시점(기준 날짜 + N일 + 시간/즉시)
--         + 내용(본문 텍스트, {이름} 치환 + 이미지 첨부)
--   - 발송 엔진: admin 의 /api/cron/auto-sms 를 pg_cron 이 10분마다 호출
--   - 과거분 스킵: 룰 생성일(KST 날짜) 이전에 발송 시점이 지난 고객은 제외
--   - 한 룰당 한 고객에게 1회만 발송 (unique 로 보장)
--
-- 이미지 규격(NHN Cloud MMS 공식): jpg/jpeg 만, 개당 최대 300KB,
-- 해상도 1000x1000 이하. (첨부는 룰당 1장으로 운영)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. 룰 테이블
-- -----------------------------------------------------------------------------
create table public.auto_sms_rules (
  id           uuid primary key default gen_random_uuid(),
  /** 문자 이름 — 내부 관리용 */
  name         text not null check (length(trim(name)) > 0),
  /** MMS 제목 (최대 40자, 비우면 발송 시 "[글로케어]" 사용) */
  title        text,
  /** 기준 날짜 필드 (customers 의 컬럼명) */
  anchor_field text not null check (anchor_field in (
    'created_at',
    'class_start_date',
    'class_end_date',
    'work_start_date',
    'work_end_date',
    'visa_change_application_date',
    'visa_change_date',
    'interview_date'
  )),
  /** 기준일로부터 며칠 후(음수 = 며칠 전, 0 = 당일) */
  offset_days  integer not null default 0 check (offset_days between -365 and 365),
  /** 발송 시간(KST). null = 즉시(도래 시 바로, 미래 날짜 도래일엔 09:00) */
  send_time    time,
  /** 본문 — {이름} 은 발송 시 고객 이름으로 치환 */
  body         text not null check (length(trim(body)) > 0),
  /** 첨부 이미지 스토리지 경로 (sms-images 버킷, 없으면 텍스트만) */
  image_path   text,
  is_active    boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

comment on table public.auto_sms_rules is
  '생애주기 자동 문자 룰. 발송 엔진은 admin /api/cron/auto-sms (pg_cron 10분마다 호출).';

create trigger trg_auto_sms_rules_updated_at
  before update on public.auto_sms_rules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. 발송 기록 테이블 (룰 x 고객당 1행 — 중복 발송 방지의 원천)
-- -----------------------------------------------------------------------------
create table public.auto_sms_sends (
  id          uuid primary key default gen_random_uuid(),
  rule_id     uuid not null references public.auto_sms_rules(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  /** 계산된 발송 예정 시각(UTC) */
  due_at      timestamptz not null,
  /** pending → sent | failed */
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default timezone('utc', now()),
  unique (rule_id, customer_id)
);

create index idx_auto_sms_sends_rule on public.auto_sms_sends(rule_id);
create index idx_auto_sms_sends_customer on public.auto_sms_sends(customer_id);

-- -----------------------------------------------------------------------------
-- 3. RLS — 직원만 (라이브 Auth 풀에 자가가입 고객도 있으므로
--    authenticated_full_access 대신 is_staff() 게이트를 쓴다)
-- -----------------------------------------------------------------------------
alter table public.auto_sms_rules  enable row level security;
alter table public.auto_sms_sends  enable row level security;

create policy auto_sms_rules_staff_all on public.auto_sms_rules
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy auto_sms_sends_staff_all on public.auto_sms_sends
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- 4. 첨부 이미지 버킷 (public — 발송 이미지는 어차피 수신자에게 공개되는 콘텐츠)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('sms-images', 'sms-images', true)
on conflict (id) do nothing;

create policy sms_images_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sms-images' and public.is_staff());

create policy sms_images_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'sms-images' and public.is_staff());

create policy sms_images_read on storage.objects
  for select to authenticated
  using (bucket_id = 'sms-images');

commit;

-- =============================================================================
-- [별도 실행 — 발송 엔진 스케줄러]
-- 아래는 스키마가 아니라 스케줄 설정이라 위와 별개로 실행한다.
-- <ADMIN_URL> 을 어드민 배포 주소(예: https://admin.example.com),
-- <CRON_SECRET> 을 Vercel 환경변수 CRON_SECRET 과 같은 값으로 바꿔서 실행할 것.
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'auto-sms-dispatch',
--   '*/10 * * * *',
--   $$
--   select net.http_post(
--     url     := '<ADMIN_URL>/api/cron/auto-sms',
--     headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--   );
--   $$
-- );
--
-- 해제: select cron.unschedule('auto-sms-dispatch');
-- =============================================================================
