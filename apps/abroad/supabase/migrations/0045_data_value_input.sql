-- 0045_data_value_input.sql
-- 학생 표준데이터 값을 "입력 원문"과 "최종 사용값"으로 분리.
--
-- 배경: 유학센터가 베트남어로 입력한 값을 한글/영어로 번역·수정해서 서류에 쓴다.
--   - value        = 최종 사용값 (문서 채움·AI 추출 등 모든 소비처가 읽는 값). 기존 컬럼 그대로.
--   - value_input  = 유학센터가 입력한 원문 (번역 전). null 이면 value 와 동일하다고 본다.
--
-- 안전: 컬럼 추가만. 기존 행/노출/RLS 변화 없음. 기존 행은 value_input = null →
--   화면에서 "입력값 == 최종값"으로 표시된다. (기존 데이터 파괴 없음)

alter table public.study_student_data_values
  add column if not exists value_input jsonb;

comment on column public.study_student_data_values.value_input is
  '유학센터가 입력한 원문(번역 전). value 는 최종 사용값(번역/수정). null 이면 value 와 동일.';
