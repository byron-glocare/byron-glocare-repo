-- =============================================================================
-- 0070: 작성서류 양식 — "양식 종류"로 묶지 않는다
--
-- 운영자 결정(2026-09-21): 작성서류는 같은 이름(입학원서)이라도 대학·학과마다 내용이 달라
--   종류(key)로 분류할 이유가 없다. 양식 파일 하나하나가 독립된 서류다.
--   · 새로 올리면 추가만 된다(같은 학과에 입학원서가 둘이어도 된다).
--   · 이전 버전은 "파일 교체"로만 생긴다(교체한 그 행의 계보 = superseded_by).
--   → 현행 유일 인덱스 (대학, 종류, 요강 학과) 를 없앤다. key 컬럼은 남긴다(옛 행 호환, 새 행은 'other').
-- 여러 번 돌려도 같다.
-- =============================================================================

drop index if exists public.uniq_study_form_files_current_dept;

comment on column public.study_admission_form_files.key is
  '옛 양식 종류. 0070 부터 쓰지 않는다(새 행은 other). 양식은 name_ko 로 구분하고, 버전은 superseded_by 계보로 잇는다.';

-- 확인 — false 여야 한다
select to_regclass('public.uniq_study_form_files_current_dept') is not null as unique_index_left;
