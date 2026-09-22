-- =============================================================================
-- 0072: Supabase 보안 경고(critical) 정리 — 0067 백업 테이블 삭제 + 불필요한 익명 읽기 차단
--
-- 경고(2026-09-19 Supabase 메일): "Table publicly accessible — rls_disabled_in_public".
--   `create table ... as select` 로 만든 백업 테이블은 RLS 가 꺼진 채 생긴다 →
--   프로젝트 URL + 공개(anon) 키만 있으면 누구나 읽고 쓸 수 있다. 실제로 익명 읽기가 됐다(확인함).
--   해당: _backup_0067_specs / _spec_doc_items / _applications / _offerings / _form_files
--   (0064·0059·0061 백업은 0065 에서 이미 삭제됨.)
--   0067 합본은 2026-09-16 에 검증 완료(요강 10·학과 23·학기 16), 이후 일주일간 운영 문제 없었다 → 삭제.
--
-- 덤: 0060/0067a 에서 익명(anon) 읽기를 열어 둔 요강·서류 카탈로그 테이블은 공개 사이트가 쓰지 않는다
--   (공개 사이트는 universities/departments/study_offerings 만 읽는다 — 코드 확인함).
--   로그인 사용자(authenticated) 정책은 그대로 두고 익명 정책만 닫는다.
-- 여러 번 돌려도 같다.
-- =============================================================================

drop table if exists public._backup_0067_specs;
drop table if exists public._backup_0067_spec_doc_items;
drop table if exists public._backup_0067_applications;
drop table if exists public._backup_0067_offerings;
drop table if exists public._backup_0067_form_files;

-- 익명 읽기 정책 제거 (로그인 사용자 정책은 유지)
drop policy if exists study_doc_standards_anon_read on public.study_doc_standards;
drop policy if exists study_doc_items_anon_read on public.study_doc_items;
drop policy if exists study_spec_departments_anon_read on public.study_spec_departments;
drop policy if exists study_spec_terms_anon_read on public.study_spec_terms;

-- 확인 1 — backups_left 0, spec_anon_policies_left 0
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename like '\_backup\_%') as backups_left,
  (select count(*) from pg_policies where schemaname = 'public' and 'anon' = any(roles)
     and tablename in ('study_doc_standards','study_doc_items','study_spec_departments','study_spec_terms')) as spec_anon_policies_left;

-- 확인 2 — RLS 가 꺼진 public 테이블이 남아 있는지 (있으면 이름이 나온다. 없으면 0줄)
select c.relname as rls_off_table
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
 order by 1;
