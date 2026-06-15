-- =============================================================================
-- 0012_caregiver_payment_and_signup.sql  (caregiver 도메인)
--
-- P2: 고객 자가가입 + 토스 결제 연동의 데이터 기반.
--
-- 설계 원칙 (어드민 코드 정독 후 확정):
--   · 결제는 기존 테이블 재사용 — reservation_payments(교육 예약금 35k, 환불필드 보유),
--     welcome_pack_payments(취업=웰컴팩: 예약금100k / 비자수수료(잔금1) / 잔금2). 스키마 변경 없음.
--   · product_type(교육 / 웰컴팩 / 교육+웰컴팩) 그대로 재사용 — 신규 product_track 없음.
--   · 신규는 최소: customers 컬럼 4개 + payment_transactions(토스 게이트웨이 원장) 1개.
--
-- 안전: 전부 additive (add column if not exists / create table if not exists).
--       기존 데이터·정책 미파괴. customers.id = uuid.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. customers 신규 컬럼 — 자가가입 / 교육생 컨펌 / 알림톡 수신동의
-- -----------------------------------------------------------------------------
alter table public.customers
  add column if not exists signup_source text,               -- 'self'(자가가입) | 'admin'(직원생성) | null(기존)
  add column if not exists application_submitted_at timestamptz, -- 신청서 제출 시각
  add column if not exists enrollment_confirmed_at timestamptz,  -- 교육생이 교육원·강의 배정 컨펌한 시각
  add column if not exists kakao_consent boolean not null default false; -- 알림톡 수신동의

-- -----------------------------------------------------------------------------
-- 2. payment_transactions — 토스 게이트웨이 거래 원장
--    이 원장이 결제 성공/입금 시 기존 결제 테이블(reservation_payments /
--    welcome_pack_payments)의 해당 칸을 채우는 소스가 된다.
-- -----------------------------------------------------------------------------
create table if not exists public.payment_transactions (
  id                bigserial primary key,
  customer_id       uuid references public.customers(id) on delete set null,
  auth_user_id      uuid references auth.users(id) on delete set null,
  -- 결제 종류 — 어떤 기존 칸을 채울지 결정
  kind              text not null,        -- 'education_reservation' | 'welcomepack_reservation'
                                          -- | 'welcomepack_interim' | 'welcomepack_balance'
  amount            integer not null,
  method            text,                 -- 'card' | 'transfer' | 'virtual_account'
  status            text not null default 'pending',
                                          -- 'pending' | 'paid' | 'waiting_deposit'(가상계좌 입금대기)
                                          -- | 'canceled' | 'failed'
  toss_order_id     text unique,          -- 우리가 생성하는 주문번호 (멱등성 키)
  toss_payment_key  text,                 -- 토스 결제 키
  va_due_date       timestamptz,          -- 가상계좌 입금기한
  paid_at           timestamptz,          -- 결제(입금) 완료 시각
  canceled_at       timestamptz,          -- 취소/환불 시각
  raw               jsonb,                -- 토스 응답 원본 (감사·디버그)
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);
create index if not exists payment_tx_customer_idx on public.payment_transactions(customer_id);
create index if not exists payment_tx_user_idx on public.payment_transactions(auth_user_id);
create index if not exists payment_tx_status_idx on public.payment_transactions(status);
create index if not exists payment_tx_order_idx on public.payment_transactions(toss_order_id);

create trigger trg_payment_tx_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. RLS — 결제는 민감정보. "본인 거래만 조회", 쓰기는 서버(service_role) 전용.
--    (service_role 키는 RLS 를 우회하므로, 토스 confirm/웹훅·어드민 서버 읽기는 정상 동작.
--     authenticated 고객은 본인 것만 SELECT, 직접 INSERT/UPDATE 불가.)
--
--    ⚠️ 별도 보안 과제: 기존 caregiver 테이블(resumes/cbt_attempts/video_views)의
--       'authenticated 전체 접근' 정책은 고객이 인증 풀에 합류하면 정보 노출이 된다.
--       자가가입 오픈(P3) 전에 역할(role) 기반으로 좁히는 마이그레이션을 별도 진행.
-- -----------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;

create policy payment_tx_owner_select on public.payment_transactions
  for select to authenticated
  using (auth_user_id = auth.uid());
