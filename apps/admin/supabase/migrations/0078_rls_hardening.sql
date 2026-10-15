-- =============================================================================
-- 0078_rls_hardening.sql — "로그인한 누구나 전부" 정책 제거
--
-- 배경: 홈페이지(caregiver) 자가가입이 생기면서 authenticated 역할에 일반 고객이
-- 포함됐는데, 관리자 시스템만 있던 시절에 만든 "authenticated 전체 허용" 정책이
-- 여러 테이블에 남아 있었다. 가입 고객이 교육원 계좌·유학 문의자 연락처·
-- 보험 청구(외국인등록번호) 등을 읽고 고칠 수 있는 상태.
--
-- 역할 모델:
--   직원        = is_glocare_staff()  (app_users 행 또는 JWT role=glocare_admin)
--   유학센터    = study_is_center_user()
--   유학생      = study_is_student()
--   가입 고객   = 위 셋 다 아닌 authenticated
--   방문자      = anon
--
-- 다시 실행해도 안전 (drop policy if exists → create).
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. 역할 판정 함수
-- -----------------------------------------------------------------------------
create or replace function public.is_glocare_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('glocare_admin', 'glocare_ceo', 'glocare_sales'), false);
$$;

create or replace function public.study_is_center_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_center_users
    where auth_user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.study_is_student()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_managed_students where auth_user_id = auth.uid()
  );
$$;

grant execute on function public.is_glocare_staff() to anon, authenticated, service_role;
grant execute on function public.study_is_center_user() to anon, authenticated, service_role;
grant execute on function public.study_is_student() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. 요양 도메인 운영 테이블 — 직원 전용
--    (홈페이지는 아래 3절의 공개 뷰로 읽는다)
-- -----------------------------------------------------------------------------
drop policy if exists authenticated_full_access on public.training_centers;
drop policy if exists training_centers_staff_all on public.training_centers;
create policy training_centers_staff_all on public.training_centers
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists authenticated_full_access on public.training_classes;
drop policy if exists training_classes_staff_all on public.training_classes;
create policy training_classes_staff_all on public.training_classes
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists authenticated_full_access on public.care_homes;
drop policy if exists care_homes_staff_all on public.care_homes;
create policy care_homes_staff_all on public.care_homes
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists authenticated_full_access on public.status_options;
drop policy if exists status_options_staff_all on public.status_options;
create policy status_options_staff_all on public.status_options
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists resume_drafts_authenticated_all on public.resume_drafts;
drop policy if exists resume_drafts_staff_all on public.resume_drafts;
create policy resume_drafts_staff_all on public.resume_drafts
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

-- -----------------------------------------------------------------------------
-- 3. 홈페이지 공개용 뷰 — 파트너 목록에 필요한 컬럼만 (계좌·연락처 제외)
--    security_invoker 가 아니므로 RLS 를 거치지 않고 안전한 컬럼만 내보낸다.
-- -----------------------------------------------------------------------------
create or replace view public.partner_training_centers as
  select id, code, name, region, tuition_fee_2026, class_hours, naeil_card_eligible,
         website_url, contract_active
    from public.training_centers
   where contract_active = true and partnership_terminated = false;

create or replace view public.partner_care_homes as
  select id, code, name, region, bed_capacity
    from public.care_homes
   where partnership_terminated = false;

grant select on public.partner_training_centers to anon, authenticated;
grant select on public.partner_care_homes to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. 유학 카탈로그 — 읽기 공개(방문자는 active 만, 로그인은 전체), 쓰기 직원
-- -----------------------------------------------------------------------------
drop policy if exists universities_authenticated_full on public.universities;
drop policy if exists universities_authenticated_read on public.universities;
drop policy if exists universities_staff_write on public.universities;
create policy universities_authenticated_read on public.universities for select to authenticated using (true);
create policy universities_staff_write on public.universities
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists departments_authenticated_full on public.departments;
drop policy if exists departments_authenticated_read on public.departments;
drop policy if exists departments_staff_write on public.departments;
create policy departments_authenticated_read on public.departments for select to authenticated using (true);
create policy departments_staff_write on public.departments
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_centers_authenticated_full on public.study_centers;
drop policy if exists study_centers_authenticated_read on public.study_centers;
drop policy if exists study_centers_staff_write on public.study_centers;
create policy study_centers_authenticated_read on public.study_centers for select to authenticated using (true);
create policy study_centers_staff_write on public.study_centers
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_cases_authenticated_full on public.study_cases;
drop policy if exists study_cases_authenticated_read on public.study_cases;
drop policy if exists study_cases_staff_write on public.study_cases;
create policy study_cases_authenticated_read on public.study_cases for select to authenticated using (true);
create policy study_cases_staff_write on public.study_cases
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_channels_authenticated_full on public.study_channels;
drop policy if exists study_channels_authenticated_read on public.study_channels;
drop policy if exists study_channels_staff_write on public.study_channels;
create policy study_channels_authenticated_read on public.study_channels for select to authenticated using (true);
create policy study_channels_staff_write on public.study_channels
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

-- -----------------------------------------------------------------------------
-- 5. 유학 문의·보험 청구 — 접수(insert)는 누구나, 조회·수정·삭제는 직원만
-- -----------------------------------------------------------------------------
drop policy if exists study_contacts_authenticated_full on public.study_contacts;
drop policy if exists study_contacts_auth_insert on public.study_contacts;
drop policy if exists study_contacts_staff_all on public.study_contacts;
create policy study_contacts_auth_insert on public.study_contacts for insert to authenticated with check (true);
create policy study_contacts_staff_all on public.study_contacts
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_insurance_claims_authenticated_full on public.study_insurance_claims;
drop policy if exists study_insurance_auth_insert on public.study_insurance_claims;
drop policy if exists study_insurance_staff_all on public.study_insurance_claims;
create policy study_insurance_auth_insert on public.study_insurance_claims for insert to authenticated with check (true);
create policy study_insurance_staff_all on public.study_insurance_claims
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

-- -----------------------------------------------------------------------------
-- 6. 유학 서류 카탈로그 — 읽기는 직원·유학센터·유학생, 쓰기는 직원
-- -----------------------------------------------------------------------------
drop policy if exists study_doc_items_authenticated_full on public.study_doc_items;
drop policy if exists study_doc_items_study_read on public.study_doc_items;
drop policy if exists study_doc_items_staff_write on public.study_doc_items;
create policy study_doc_items_study_read on public.study_doc_items for select to authenticated
  using (public.is_glocare_staff() or public.study_is_center_user() or public.study_is_student());
create policy study_doc_items_staff_write on public.study_doc_items
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_doc_standards_authenticated_full on public.study_doc_standards;
drop policy if exists study_doc_standards_study_read on public.study_doc_standards;
drop policy if exists study_doc_standards_staff_write on public.study_doc_standards;
create policy study_doc_standards_study_read on public.study_doc_standards for select to authenticated
  using (public.is_glocare_staff() or public.study_is_center_user() or public.study_is_student());
create policy study_doc_standards_staff_write on public.study_doc_standards
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_spec_departments_authenticated_full on public.study_spec_departments;
drop policy if exists study_spec_departments_study_read on public.study_spec_departments;
drop policy if exists study_spec_departments_staff_write on public.study_spec_departments;
create policy study_spec_departments_study_read on public.study_spec_departments for select to authenticated
  using (public.is_glocare_staff() or public.study_is_center_user() or public.study_is_student());
create policy study_spec_departments_staff_write on public.study_spec_departments
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_spec_doc_items_authenticated_full on public.study_spec_doc_items;
drop policy if exists study_spec_doc_items_study_read on public.study_spec_doc_items;
drop policy if exists study_spec_doc_items_staff_write on public.study_spec_doc_items;
create policy study_spec_doc_items_study_read on public.study_spec_doc_items for select to authenticated
  using (public.is_glocare_staff() or public.study_is_center_user() or public.study_is_student());
create policy study_spec_doc_items_staff_write on public.study_spec_doc_items
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

drop policy if exists study_spec_terms_authenticated_full on public.study_spec_terms;
drop policy if exists study_spec_terms_study_read on public.study_spec_terms;
drop policy if exists study_spec_terms_staff_write on public.study_spec_terms;
create policy study_spec_terms_study_read on public.study_spec_terms for select to authenticated
  using (public.is_glocare_staff() or public.study_is_center_user() or public.study_is_student());
create policy study_spec_terms_staff_write on public.study_spec_terms
  for all to authenticated using (public.is_glocare_staff()) with check (public.is_glocare_staff());

commit;
