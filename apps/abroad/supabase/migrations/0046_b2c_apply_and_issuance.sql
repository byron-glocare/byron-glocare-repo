-- 0046_b2c_apply_and_issuance.sql
-- youstudyinkorea.com B2C 유학 지원 + 발급대행 커머스 — 기반 스키마.
--
-- 결정(2026-07):
--   · 학생 = 기존 study_managed_students 확장(auth_user_id + source), 셀프가입은 글로케어 org 귀속.
--   · 대학 3분류 = universities.tier(partner/open) + 미등록은 study_university_requests.
--   · 발급대행 단가 = 서류 × 인증조건 단가표(대학 무관) study_issuance_pricing.
--   · 결제 = 기존 payment_transactions 재사용(주문에 order id 연결).
--
-- 안전: 기존 테이블은 **컬럼 추가 + 정책 ADD** 만(기존 정책/노출 무변). 신규 테이블은 자체 RLS.

-- =============================================================================
-- 1) 대학 등급
-- =============================================================================
alter table public.universities
  add column if not exists tier text not null default 'open'
    check (tier in ('partner','open'));
comment on column public.universities.tier is
  'partner=글로케어 협약(서류작성+지원컨설팅), open=자유지원(서류작성만, 학생이 직접 지원). 미등록 대학은 study_university_requests.';

-- =============================================================================
-- 2) 학생 셀프가입 (구글 로그인)
-- =============================================================================
alter table public.study_managed_students
  add column if not exists auth_user_id uuid references auth.users(id),
  add column if not exists source text not null default 'center'
    check (source in ('center','self'));

-- 셀프가입(B2C) 학생은 유학센터 org 에 속하지 않는다 → org_id 를 nullable 로.
--   (기존 센터 등록 학생 행은 org_id 유지 — 값 손실 없음. 소유권은 auth_user_id 로 판별.)
alter table public.study_managed_students
  alter column org_id drop not null;

create unique index if not exists study_managed_students_auth_user_id_key
  on public.study_managed_students(auth_user_id)
  where auth_user_id is not null;

comment on column public.study_managed_students.auth_user_id is
  '셀프가입(구글) 학생의 auth.users. 센터 등록 학생은 null.';
comment on column public.study_managed_students.source is
  'center=유학센터 등록, self=B2C 셀프가입(글로케어 org 귀속).';

-- 글로케어 본사 관리자 판별 헬퍼 (기존 RLS 는 매번 인라인했음 — 여기서 함수화해 재사용)
create or replace function public.study_is_glocare_admin()
returns boolean
language sql stable as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin';
$$;

-- 본인 학생 판별 헬퍼 (RLS 재사용)
create or replace function public.study_is_my_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_managed_students s
    where s.id = p_student and s.auth_user_id = auth.uid()
  );
$$;

-- 기존 테이블에 "본인 학생" 접근 정책 ADD (기존 org/센터 정책은 그대로 둠 = 추가 허용)
drop policy if exists sms_self_rw on public.study_managed_students;
create policy sms_self_rw on public.study_managed_students
  for all to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists ssdv_self_rw on public.study_student_data_values;
create policy ssdv_self_rw on public.study_student_data_values
  for all to authenticated
  using (public.study_is_my_student(student_id))
  with check (public.study_is_my_student(student_id));

drop policy if exists sa_self_rw on public.study_applications;
create policy sa_self_rw on public.study_applications
  for all to authenticated
  using (public.study_is_my_student(student_id))
  with check (public.study_is_my_student(student_id));

drop policy if exists ssf_self_rw on public.study_student_submission_files;
create policy ssf_self_rw on public.study_student_submission_files
  for all to authenticated
  using (public.study_is_my_student(student_id))
  with check (public.study_is_my_student(student_id));

-- =============================================================================
-- 3) 미등록 대학 추가 요청
-- =============================================================================
create table if not exists public.study_university_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.study_managed_students(id) on delete set null,
  requested_by uuid references auth.users(id),
  university_name text not null,
  university_url text,
  note text,
  status text not null default 'pending' check (status in ('pending','added','rejected')),
  resolved_university_id bigint references public.universities(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sur_status_idx on public.study_university_requests(status, created_at desc);

alter table public.study_university_requests enable row level security;
drop policy if exists sur_self on public.study_university_requests;
create policy sur_self on public.study_university_requests
  for all to authenticated
  using (requested_by = auth.uid() or public.study_is_glocare_admin())
  with check (requested_by = auth.uid() or public.study_is_glocare_admin());

-- =============================================================================
-- 4) 발급대행 단가표 (서류 × 인증조건, 대학 무관)
-- =============================================================================
create table if not exists public.study_issuance_pricing (
  id uuid primary key default gen_random_uuid(),
  -- 표준 발급서류 카탈로그 연결(있으면). 자유표기도 허용.
  std_key text,
  label_ko text not null,
  -- 인증 조건 — required_documents.notarization 값과 정합
  notarization text not null default 'none'
    check (notarization in ('none','translation_notarization','consul','consul_for_vietnam','apostille','apostille_or_consul')),
  -- 대리인 발급 불가 시 추가되는 금액(원). 기본가에 옵션으로 가산.
  unit_price integer not null default 0,
  proxy_unavailable_surcharge integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sip_active_idx on public.study_issuance_pricing(is_active, sort_order);

alter table public.study_issuance_pricing enable row level security;
-- 가격표는 로그인 학생이 읽을 수 있어야(견적 노출), 편집은 글로케어만
drop policy if exists sip_read on public.study_issuance_pricing;
create policy sip_read on public.study_issuance_pricing
  for select to authenticated using (is_active or public.study_is_glocare_admin());
drop policy if exists sip_write on public.study_issuance_pricing;
create policy sip_write on public.study_issuance_pricing
  for all to authenticated
  using (public.study_is_glocare_admin())
  with check (public.study_is_glocare_admin());

-- =============================================================================
-- 5) 발급대행 주문 + 항목
-- =============================================================================
-- 상태머신: draft → payment_pending → paid → info_needed → assigned → contacted
--          → in_progress → scheduled → issued → shipped → done  (+ cancelled)
create table if not exists public.study_issuance_orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.study_managed_students(id) on delete cascade,
  university_id bigint references public.universities(id),
  status text not null default 'draft'
    check (status in ('draft','payment_pending','paid','info_needed','assigned',
                      'contacted','in_progress','scheduled','issued','shipped','done','cancelled')),
  subtotal integer not null default 0,           -- 원
  -- 결제(기존 원장 재사용)
  payment_transaction_id uuid,
  toss_order_id text unique,                     -- 멱등키(결제 생성 시)
  paid_at timestamptz,
  -- 진행에 필요한 연락/신원 정보 스냅샷(4번 요건)
  contact_snapshot jsonb,                        -- {student_name, phone, email, parent_name, parent_phone, parent_address, schools:[{level,name,addr}]}
  info_completed_at timestamptz,
  -- 운영(담당자)
  manager_note text,
  eta_date date,                                 -- 발급 완료 예정일(고객 노출)
  result_pdf_path text,                          -- 발급 pdf(비공개 버킷)
  shipped_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sio_student_idx on public.study_issuance_orders(student_id, created_at desc);
create index if not exists sio_status_idx on public.study_issuance_orders(status, created_at desc);

create table if not exists public.study_issuance_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.study_issuance_orders(id) on delete cascade,
  pricing_id uuid references public.study_issuance_pricing(id),
  label_ko text not null,
  notarization text not null default 'none',
  unit_price integer not null default 0,
  proxy_surcharge integer not null default 0,
  qty integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists sioi_order_idx on public.study_issuance_order_items(order_id);

alter table public.study_issuance_orders enable row level security;
alter table public.study_issuance_order_items enable row level security;

drop policy if exists sio_access on public.study_issuance_orders;
create policy sio_access on public.study_issuance_orders
  for all to authenticated
  using (public.study_is_my_student(student_id) or public.study_is_glocare_admin())
  with check (public.study_is_my_student(student_id) or public.study_is_glocare_admin());

drop policy if exists sioi_access on public.study_issuance_order_items;
create policy sioi_access on public.study_issuance_order_items
  for all to authenticated
  using (exists (
    select 1 from public.study_issuance_orders o
    where o.id = order_id
      and (public.study_is_my_student(o.student_id) or public.study_is_glocare_admin())
  ))
  with check (exists (
    select 1 from public.study_issuance_orders o
    where o.id = order_id
      and (public.study_is_my_student(o.student_id) or public.study_is_glocare_admin())
  ));
