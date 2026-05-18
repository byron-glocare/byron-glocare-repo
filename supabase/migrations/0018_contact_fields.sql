-- =============================================================================
-- 0018: 교육원 / 요양원 연락처 필드 정리
--
-- 정의:
--   - phone           : 대표 연락처 (사업장 대표번호, 지역번호 포함 가능)
--   - director_name   : 대표자 이름
--   - director_phone  : 대표자 연락처 (보통 휴대폰)
--   - contact_person  : 담당자 이름
--   - contact_phone   : 담당자 연락처 (보통 휴대폰)
--
-- 모두 nullable / 필수 아님.
--
-- training_centers 에 director_phone / contact_person / contact_phone 추가.
-- care_homes 에 director_phone 추가 (나머지는 이미 있음).
-- =============================================================================

begin;

-- training_centers
alter table public.training_centers
  add column director_phone text,
  add column contact_person text,
  add column contact_phone  text;

comment on column public.training_centers.phone is
  '대표 연락처 (사업장 대표번호, 지역번호 포함 가능)';
comment on column public.training_centers.director_name is
  '대표자 이름';
comment on column public.training_centers.director_phone is
  '대표자 연락처 (휴대폰 등)';
comment on column public.training_centers.contact_person is
  '담당자 이름';
comment on column public.training_centers.contact_phone is
  '담당자 연락처 (휴대폰 등)';

-- care_homes
alter table public.care_homes
  add column director_phone text;

comment on column public.care_homes.phone is
  '대표 연락처 (사업장 대표번호, 지역번호 포함 가능)';
comment on column public.care_homes.director_name is
  '대표자 이름';
comment on column public.care_homes.director_phone is
  '대표자 연락처 (휴대폰 등)';
comment on column public.care_homes.contact_person is
  '담당자 이름';
comment on column public.care_homes.contact_phone is
  '담당자 연락처 (휴대폰 등)';

commit;
