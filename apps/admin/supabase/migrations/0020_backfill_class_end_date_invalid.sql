-- =============================================================================
-- 0020: training_classes 종료일 재정비 (NULL OR start_date 이전 → 자동 backfill)
--
-- 0015 에서 NULL 만 backfill 했는데, 운영 중 end_date 가 start_date 보다
-- 이전으로 잘못 입력된 케이스 발견 (예: 2025-11-26 시작인데 end_date 가
-- 2025-01-23 — 사용자 입력 실수로 추정). phase 계산 시 즉시 '완료' 로
-- 빠지거나, customer.class_end_date sync 가 어긋나서 '교육 중' 으로 잘못
-- 표시되는 원인.
--
-- 처리:
--   - end_date IS NULL OR end_date < start_date  → end_date = start + 2/3개월
--   - 동시에 customers.class_end_date 도 sync (해당 training_class_id 매칭)
-- =============================================================================

begin;

-- 1) training_classes 재정비
update public.training_classes
   set end_date = case
     when class_type = 'weekday' then (start_date + interval '2 months')::date
     when class_type = 'night'   then (start_date + interval '3 months')::date
   end
 where start_date is not null
   and (end_date is null or end_date < start_date);

-- 2) 매칭된 customers.class_end_date 도 같이 sync
--    (수정된 강의를 가진 customer 들의 class_end_date 를 새 end_date 로 update)
update public.customers c
   set class_end_date = tc.end_date,
       class_start_date = tc.start_date
  from public.training_classes tc
 where c.training_class_id = tc.id
   and tc.start_date is not null;

commit;
