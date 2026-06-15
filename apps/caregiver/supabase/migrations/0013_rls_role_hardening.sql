-- =============================================================================
-- 0013_rls_role_hardening.sql  (공유 + caregiver 도메인)
--
-- 목적: 고객 자가가입(P3) 오픈 전, RLS 를 "역할 기반"으로 강화.
--   기존: 모든 테이블 'authenticated_full_access' = 로그인만 하면 전체 접근.
--          → 어드민만 로그인하던 시절엔 OK. 고객이 인증 풀에 합류하면 정보 누수.
--   변경: 직원(staff)=전체 / 고객=본인 것만.
--
-- 규칙(운영자 확정): 홈페이지 가입 = 고객, 어드민에서 권한 부여 = 직원.
--   → 직원은 app_users 에 명시 등록, 자가가입자는 기본 고객.
--
-- ⚠️ 무잠김 설계 (순서 중요):
--   1) app_users 생성  2) 현재 모든 auth 계정을 직원으로 시드 (지금=사실상 직원)
--   3) 그 다음 정책 교체 → 교체 시점에 현 사용자는 전부 staff 이므로 잠김 없음.
--   + 어드민 service_role 은 RLS 우회(최후 안전망). anon 정책은 미변경(공개 페이지 영향 0).
--
-- 적용 후 즉시 검증: 어드민에 로그인해 고객 목록이 보이면 시드 성공.
--   (혹시 비면: insert into app_users 시드가 비었던 것 — auth.users 확인)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. app_users — 직원/관리자 등록 (역할)
-- -----------------------------------------------------------------------------
create table if not exists public.app_users (
  auth_user_id     uuid primary key references auth.users(id) on delete cascade,
  role             text not null default 'glocare_admin',  -- 'glocare_admin' | 'study_center_admin'(예정)
  study_center_id  uuid,                                   -- study_center_admin 범위 제한용(예정)
  created_at       timestamptz not null default timezone('utc', now())
);

-- 무잠김 시드: 현재 존재하는 모든 계정 = 직원으로 등록
insert into public.app_users (auth_user_id, role)
  select id, 'glocare_admin' from auth.users
  on conflict (auth_user_id) do nothing;

-- (런칭 전 정리: 테스트용 고객 계정은 아래로 직원에서 제외)
--   delete from public.app_users where auth_user_id =
--     (select id from auth.users where email = 'test-customer@example.com');

-- -----------------------------------------------------------------------------
-- 2. is_staff() — 정책에서 직원 여부 판정
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where auth_user_id = auth.uid());
$$;

alter table public.app_users enable row level security;
-- 직원만 직원목록 조회. 등록/변경은 service_role(서버) 전용 → 고객이 스스로 직원 될 수 없음.
drop policy if exists app_users_staff_read on public.app_users;
create policy app_users_staff_read on public.app_users
  for select to authenticated using (is_staff());

-- -----------------------------------------------------------------------------
-- 3. 공유 테이블 — 직원 전체 / 고객 본인만
-- -----------------------------------------------------------------------------

-- customers: 직원 전체 + 고객 본인 행 조회 (쓰기는 직원/서버. 자가가입 insert 는 P3 서버 흐름)
drop policy if exists "authenticated_full_access" on public.customers;
create policy customers_staff_all on public.customers
  for all to authenticated using (is_staff()) with check (is_staff());
create policy customers_owner_read on public.customers
  for select to authenticated using (auth_user_id = auth.uid());

-- 고객 결제 3종: 직원 전체 + 고객 본인 결제 조회
do $$
declare tbl text;
begin
  foreach tbl in array array['reservation_payments','welcome_pack_payments','event_payments']
  loop
    execute format('drop policy if exists %I on public.%I', 'authenticated_full_access', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      tbl || '_staff_all', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.customers c where c.id = %I.customer_id and c.auth_user_id = auth.uid()))',
      tbl || '_owner_read', tbl, tbl);
  end loop;
end $$;

-- 내부 전용(고객 접근 불필요): 직원만
do $$
declare tbl text;
begin
  foreach tbl in array array['commission_payments','customer_statuses','customer_consultations','sms_messages','system_settings']
  loop
    execute format('drop policy if exists %I on public.%I', 'authenticated_full_access', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      tbl || '_staff_all', tbl);
  end loop;
end $$;

-- customer_reminders (0016 에서 동일 정책명) — 직원만
drop policy if exists "authenticated_full_access" on public.customer_reminders;
create policy customer_reminders_staff_all on public.customer_reminders
  for all to authenticated using (is_staff()) with check (is_staff());

-- -----------------------------------------------------------------------------
-- 4. caregiver 전용 테이블 (0011) — 정책명 '<t>_authenticated_all'
-- -----------------------------------------------------------------------------

-- 본인 소유 데이터: 직원 전체 + 본인(user_id) 전체
do $$
declare tbl text;
begin
  foreach tbl in array array['resumes','cbt_attempts','video_views']
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_authenticated_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      tbl || '_staff_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      tbl || '_owner_all', tbl);
  end loop;
end $$;

-- 공개 콘텐츠: 직원 쓰기 + 로그인 사용자 읽기(active). anon read 는 0011 정책 유지.
do $$
declare tbl text;
begin
  foreach tbl in array array['videos','cbt_questions']
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_authenticated_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      tbl || '_staff_all', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (active = true)',
      tbl || '_auth_read', tbl);
  end loop;
end $$;

-- ambassador_config: 직원 쓰기 + 로그인 읽기. anon read 유지.
drop policy if exists ambassador_config_authenticated_all on public.ambassador_config;
create policy ambassador_config_staff_all on public.ambassador_config
  for all to authenticated using (is_staff()) with check (is_staff());
create policy ambassador_config_auth_read on public.ambassador_config
  for select to authenticated using (true);

-- caregiver_contacts: 직원 전체 + 본인 제출분 조회. anon insert(폼) 유지.
drop policy if exists caregiver_contacts_authenticated_all on public.caregiver_contacts;
create policy caregiver_contacts_staff_all on public.caregiver_contacts
  for all to authenticated using (is_staff()) with check (is_staff());
create policy caregiver_contacts_owner_read on public.caregiver_contacts
  for select to authenticated using (auth_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 5. payment_transactions (0012) — 직원 전체 추가 (본인 조회는 0012 에 이미 존재)
-- -----------------------------------------------------------------------------
drop policy if exists payment_tx_staff_all on public.payment_transactions;
create policy payment_tx_staff_all on public.payment_transactions
  for all to authenticated using (is_staff()) with check (is_staff());
