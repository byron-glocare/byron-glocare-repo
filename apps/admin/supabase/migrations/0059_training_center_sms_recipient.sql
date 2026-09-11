-- =============================================================================
-- 0059: 교육원 문자 발송 수신 번호 선택
--
-- 교육원 상세의 연락처 3개(대표 phone / 대표자 director_phone / 담당자
-- contact_phone) 중 어디로 안내 문자를 보낼지 운영자가 라디오로 선택.
--
-- null = 미선택 — 기존 로직 유지:
--   신규 교육생 알림 = phone(대표), 정산 발송 = director_phone → phone.
-- 선택된 칸이 비어있을 때도 기존 로직으로 fallback (코드 참조: lib/sms-recipient.ts)
-- =============================================================================

begin;

alter table public.training_centers
  add column sms_recipient text
  check (sms_recipient in ('phone', 'director', 'contact'));

comment on column public.training_centers.sms_recipient is
  '안내 문자 수신 번호 선택 (phone=대표, director=대표자, contact=담당자). null=미선택(기존 fallback 로직).';

commit;
