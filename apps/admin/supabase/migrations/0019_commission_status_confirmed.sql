-- =============================================================================
-- 0019: commission_payments.status 에 'confirmed' 추가
--
-- 정산 흐름 (0011 이후):
--   confirmed = 정산 금액이 확정됨 (발송 대기). 정산 예정에서 빠지고 발송
--               알림 페이지 (/sms/commission) 에 표시.
--   completed = 정상 수금 완료
--   abandoned = 수금 포기
--
-- backfill 없음 — 기존 데이터는 completed/abandoned 그대로 유지.
-- =============================================================================

begin;

alter table public.commission_payments
  drop constraint if exists commission_payments_status_check;

alter table public.commission_payments
  add constraint commission_payments_status_check
  check (status in ('confirmed', 'completed', 'abandoned'));

commit;
