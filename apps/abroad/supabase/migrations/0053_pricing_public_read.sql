-- 0053: 판매 상품 단가표 공개 조회 허용
--
-- 0050 으로 상품 2종을 넣었는데도 /service 에 "금액 준비 중" 으로 나온다.
-- 값이 없어서가 아니라 RLS 때문이다 — 공개 페이지는 anon 키로 읽는데
-- study_issuance_pricing 에 anon SELECT 를 허용하는 정책이 없어서 0건으로 돌아온다.
-- (service_role 로 읽으면 정상적으로 2행이 보인다.)
--
-- 막히는 화면:
--   /service, /service/[slug]        anon
--   /student/order/[slug]            로그인 학생 — 결제 금액을 못 읽어 주문 생성 실패
--   /student/issuance                로그인 학생 — 발급 카탈로그가 빈 목록
--
-- 카드사 심사에서 "결제 가능한 실제 판매 상품이 공개 URL 에서 확인될 것"을 보므로
-- 금액은 로그인 없이 보여야 한다. 판매 중(is_active) 인 행만 연다.
--
-- ⚠ 기존 정책은 건드리지 않는다. 정책은 OR 로 합쳐지므로 이 정책을 더해도
--    다른 역할의 권한은 그대로다. (RLS 활성화 상태도 바꾸지 않는다.)
--
-- 멱등: 같은 이름 정책만 지우고 다시 만든다.

drop policy if exists "study_issuance_pricing_public_read"
  on public.study_issuance_pricing;

create policy "study_issuance_pricing_public_read"
  on public.study_issuance_pricing
  for select
  to anon, authenticated
  using (is_active = true);

-- 확인용 — anon 키로 아래가 2행이면 정상
-- select std_key, unit_price from public.study_issuance_pricing where is_active;
