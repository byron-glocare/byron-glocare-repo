-- =============================================================================
-- 0085: 학교 양식 베트남어 이름 (KAN-40)
--
-- 모집요강 PDF 베트남어판의 「Mẫu đơn của trường: …」 줄이 양식 한국어 이름을 그대로 찍어
-- 출력 PC 에 따라 한글이 빠지거나 섞였다. 베트남어 이름 칸을 둔다(비면 PDF 베트남어판에서 그 줄을 뺀다).
--
-- 안전: 비어 있는 칸만 추가. 기존 데이터 변경 없음. 여러 번 돌려도 같다.
-- ⚠ 이 SQL 을 먼저 실행한 뒤 배포한다 — 새 코드가 이 칸을 읽는다.
-- =============================================================================

alter table public.study_admission_form_files
  add column if not exists name_vi text;

-- 확인 — has_column true
select exists (
  select 1 from information_schema.columns
   where table_schema = 'public' and table_name = 'study_admission_form_files' and column_name = 'name_vi'
) as has_column;
