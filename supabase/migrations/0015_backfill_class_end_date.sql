-- =============================================================================
-- 0015: training_classes 종료일 backfill
--
-- 모든 개강 정보에서 end_date 가 NULL 인 row 에 대해:
--   - class_type='weekday' (주간) → end_date = start_date + 2개월
--   - class_type='night'   (야간) → end_date = start_date + 3개월
--
-- start_date 도 NULL 이면 스킵 (계산 불가).
-- idempotent — 재실행 안전 (이미 end_date 있으면 변경 없음).
--
-- 참고: PostgreSQL 의 date + interval '2 months' 는 1/31 + 1m → 2월 마지막날
-- 로 자동 클램프. JavaScript Date 의 setMonth() 와 약간 다른 동작 (JS 는
-- 다음 달로 넘김) 이지만 운영상 거의 영향 없음.
-- =============================================================================

begin;

update public.training_classes
   set end_date = case
     when class_type = 'weekday' then (start_date + interval '2 months')::date
     when class_type = 'night'   then (start_date + interval '3 months')::date
   end
 where end_date is null
   and start_date is not null;

commit;
