-- 0032: 웰컴팩 결제 — 4·5회차 추가 컬럼 + 메모
--
-- 기존 3회차 (예약/잔금1/잔금2) 외에 4·5회차를 동적으로 추가할 수 있게.
-- 4·5회차는 "있을 수도 / 없을 수도" — amount=0 && date is null 이면 미입력으로 간주.
-- notes 컬럼은 자유 메모 (정산 협의 사항, 환불 사유 등 운영 노트).

alter table public.welcome_pack_payments
  add column if not exists installment4_amount integer not null default 0,
  add column if not exists installment4_date    date,
  add column if not exists installment5_amount integer not null default 0,
  add column if not exists installment5_date    date,
  add column if not exists notes                text;
