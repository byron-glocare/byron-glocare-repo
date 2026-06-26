-- 작성서류(docx) 양식: 빈칸(슬롯) 단위 배치 매핑.
--   label_mapping(라벨→표준데이터)에 더해, slot_mapping(빈칸번호→표준데이터)으로
--   "어느 빈칸에 어떤 값을 넣을지" 관리자가 미리보기에서 직접 지정한 것을 저장.
--   키 = 문서 순서의 빈 셀 인덱스("0","1",...), 값 = 표준데이터 key (""=채우지 않음).
alter table public.study_admission_form_files
  add column if not exists slot_mapping jsonb not null default '{}'::jsonb;
