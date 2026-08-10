-- 0050: 실제 판매 상품 2종 등록
--
-- 카드사 심사 요구사항: "홈페이지에 결제 가능한 실제 판매 상품 1개 이상(테스트 상품 불가)".
-- 판매 상품을 아래 2종으로 확정한다.
--
--   1) doc_fullset      서류 발급 풀세트            150,000원
--      졸업·성적증명서 발급 + 번역·공증 + 영사확인까지. 서류만 받아보는 상품.
--   2) full_consulting  유학 준비 종합 컨설팅        600,000원
--      1번을 포함해 지원 서류 작성·준비 전 과정을 대행. 단건 결제 최고가.
--
-- ⚠ 0047_seed_issuance_pricing.sql 은 실행하지 말 것 — 서류 10종을 개별 상품으로
--    넣는 예시 시드라 위 2종 체계와 충돌한다(현재 미실행 상태).
--
-- 멱등: 같은 std_key 가 이미 있으면 금액·라벨만 갱신한다.

-- ── 1. 신규 삽입 (없을 때만) ────────────────────────────────────────────────
insert into public.study_issuance_pricing
  (std_key, label_ko, notarization, unit_price, proxy_unavailable_surcharge,
   is_active, sort_order)
select v.std_key, v.label_ko, v.notarization, v.unit_price, v.surcharge, true, v.sort_order
from (values
  ('doc_fullset',     '서류 발급 풀세트',      'consul_for_vietnam', 150000, 0, 10),
  ('full_consulting', '유학 준비 종합 컨설팅',  'consul_for_vietnam', 600000, 0, 20)
) as v(std_key, label_ko, notarization, unit_price, surcharge, sort_order)
where not exists (
  select 1 from public.study_issuance_pricing p where p.std_key = v.std_key
);

-- ── 2. 이미 있으면 금액·라벨 갱신 (재실행 안전) ─────────────────────────────
update public.study_issuance_pricing p set
  label_ko    = v.label_ko,
  unit_price  = v.unit_price,
  is_active   = true,
  sort_order  = v.sort_order,
  updated_at  = now()
from (values
  ('doc_fullset',     '서류 발급 풀세트',     150000, 10),
  ('full_consulting', '유학 준비 종합 컨설팅', 600000, 20)
) as v(std_key, label_ko, unit_price, sort_order)
where p.std_key = v.std_key;

-- ── 3. 그 외 항목이 남아 있으면 판매 중단 처리 (심사 시 테스트 상품 노출 방지) ──
update public.study_issuance_pricing
   set is_active = false, updated_at = now()
 where std_key not in ('doc_fullset', 'full_consulting');

-- 확인용
-- select std_key, label_ko, unit_price, is_active, sort_order
--   from public.study_issuance_pricing order by sort_order;
