-- 0079: training_classes.class_type 에 '주말'(weekend) 옵션 추가
--
-- 기존 CHECK 제약은 ('weekday', 'night') 만 허용했다. '주말반' 개강 일정을
-- 등록할 수 있도록 'weekend' 를 허용 값에 추가한다.
--
-- 안전:
--   - 기존 데이터(weekday / night)는 그대로 통과 — 삭제·변경 없음.
--   - 허용 값만 넓히는 변경이라 운영 데이터에 영향 없음.
--   - 0001 의 인라인 컬럼 체크는 Postgres 기본 이름
--     training_classes_class_type_check 로 생성된다.

alter table public.training_classes
  drop constraint if exists training_classes_class_type_check;

alter table public.training_classes
  add constraint training_classes_class_type_check
  check (class_type in ('weekday', 'night', 'weekend'));
