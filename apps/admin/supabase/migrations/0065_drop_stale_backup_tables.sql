-- 스테일 백업 테이블 정리 (Supabase RLS 보안 경고 대응)
--
--   서류 카탈로그 재정비(0057/0061/0064) 때 안전용으로 실데이터를 public._backup_*
--   로 복사해뒀는데, RLS 미설정 + 삭제 누락으로 public 스키마에 방치됨.
--   Supabase 린터가 "rls_disabled_in_public" (critical) 로 경고 → 실데이터 복사본이
--   anon 키로 노출되던 상태. 원본 정식 테이블은 정상(RLS 적용)이고, 앱 코드는
--   _backup_* 를 참조하지 않으므로 그냥 삭제한다. (Nano 용량도 확보)
--
--   해당 마이그레이션은 이미 적용·검증 완료 → 백업 롤백 용도는 소멸.
drop table if exists public._backup_0057_types;
drop table if exists public._backup_0057_specs;
drop table if exists public._backup_0057_forms;
drop table if exists public._backup_0057_subs;
drop table if exists public._backup_0059_submission_files;
drop table if exists public._backup_0061_specs;
drop table if exists public._backup_0064_specs;
drop table if exists public._backup_0064_spec_doc_items;
drop table if exists public._backup_0064_doc_standards;
drop table if exists public._backup_0064_doc_items;
