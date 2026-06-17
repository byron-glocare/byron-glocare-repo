-- 0028: 작성서류 양식(PDF) 좌표 오버레이 채움 메타
--
-- study_admission_form_files.field_overlays:
--   원본 양식 PDF 위에 학생 데이터를 "어디에 그릴지" 좌표 목록.
--   JSON 배열, 각 항목:
--     {
--       "key":  "<data_type_key | essay:N>",  -- 그릴 값의 출처
--       "page": 0,        -- 0-based 페이지 인덱스
--       "x":    120.5,    -- PDF 포인트, 좌하단 원점 기준 가로
--       "y":    640.0,    -- PDF 포인트, 좌하단 원점 기준 세로 (텍스트 baseline)
--       "size": 11,       -- (선택) 폰트 크기 pt, 기본 11
--       "maxWidth": 200   -- (선택) 이 폭을 넘으면 자동 축소/줄바꿈
--     }
--   빈 배열 = 좌표 미지정 → 채움 PDF 대신 기존 데이터시트(docx) 폴백.
--
-- 운영자: Supabase SQL 에디터에 붙여넣어 실행.

alter table public.study_admission_form_files
  add column if not exists field_overlays jsonb not null default '[]'::jsonb;

comment on column public.study_admission_form_files.field_overlays is
  '원본 PDF 좌표 오버레이 [{key,page,x,y,size?,maxWidth?}] — 학생 데이터 채움 위치. 빈 배열=미지정.';
