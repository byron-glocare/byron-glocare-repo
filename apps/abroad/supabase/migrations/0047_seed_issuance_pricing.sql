-- 0047_seed_issuance_pricing.sql
-- 발급대행 단가표(study_issuance_pricing) 예시 시드.
--   · P3a 발급대행 신청 화면이 이 카탈로그를 그대로 노출한다.
--   · 금액은 예시(원). 운영자가 실제 단가로 수정하면 됨.
--   · 멱등: (label_ko, notarization) 이 이미 있으면 넣지 않는다 → 여러 번 실행해도 안전.

insert into public.study_issuance_pricing
  (std_key, label_ko, notarization, unit_price, proxy_unavailable_surcharge, is_active, sort_order)
select v.std_key, v.label_ko, v.notarization, v.unit_price, v.surcharge, true, v.sort_order
from (values
  ('graduation_cert', '졸업증명서',        'none',                    30000, 20000, 10),
  ('graduation_cert', '졸업증명서',        'translation_notarization', 80000, 20000, 11),
  ('graduation_cert', '졸업증명서',        'consul_for_vietnam',      150000, 30000, 12),
  ('transcript',      '성적증명서',        'none',                    30000, 20000, 20),
  ('transcript',      '성적증명서',        'translation_notarization', 80000, 20000, 21),
  ('family_relation', '가족관계증명서',    'none',                    20000, 20000, 30),
  ('family_relation', '가족관계증명서',    'consul_for_vietnam',      130000, 30000, 31),
  ('basic_cert',      '기본증명서',        'none',                    20000, 20000, 40),
  ('bank_balance',    '은행 잔고증명서',   'none',                    40000, 20000, 50),
  ('apostille',       '아포스티유 (서류당)', 'apostille',              120000, 0,     60)
) as v(std_key, label_ko, notarization, unit_price, surcharge, sort_order)
where not exists (
  select 1 from public.study_issuance_pricing p
  where p.label_ko = v.label_ko and p.notarization = v.notarization
);
