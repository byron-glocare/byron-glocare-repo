-- =============================================================================
-- 0006: 계약상태 boolean 전환 + 전체 code 재발급
--
-- 1. training_centers.contract_status (text) 제거 + contract_active (boolean)
--    추가. 기존 값에 "완료" 포함 여부로 backfill.
-- 2. customers / training_centers / care_homes 의 code 를 KST 기준
--    created_at 의 YYMM + 월별 순번 3자리로 일괄 재발급.
--    prefix: CVN (고객), TC (교육원), CH (요양원)
--
-- 재발급은 2-step: UNIQUE 제약이 row-by-row 로 즉시 검증되므로
-- 기존 code 와 새 code 가 같은 값을 순환 참조할 때 중간에 충돌한다.
-- 그래서 1) 먼저 임시 prefix (TMP-{uuid}) 로 전부 비켜놓고
-- 2) 그 다음 최종 code 로 덮어쓴다.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. contract_status -> contract_active
-- -----------------------------------------------------------------------------

alter table public.training_centers
  add column contract_active boolean not null default false;

update public.training_centers
   set contract_active = true
 where contract_status is not null
   and contract_status ilike '%완료%';

alter table public.training_centers
  drop column contract_status;

comment on column public.training_centers.contract_active is
  '교육원 계약 체결 여부. ON = 계약 완료.';

-- -----------------------------------------------------------------------------
-- 2. code 재발급 (2-step)
-- -----------------------------------------------------------------------------

-- step 1: 임시 prefix 로 비켜놓기 (id 기반이라 유일성 보장)
update public.customers        set code = 'TMP-' || id::text;
update public.training_centers set code = 'TMP-' || id::text;
update public.care_homes       set code = 'TMP-' || id::text;

-- step 2: 최종 code 재발급

-- 고객 — CVN + YYMM + 월별 순번 3자리
with ordered as (
  select
    id,
    'CVN' ||
      to_char((created_at at time zone 'Asia/Seoul')::date, 'YYMM') ||
      lpad(
        row_number() over (
          partition by to_char((created_at at time zone 'Asia/Seoul')::date, 'YYMM')
          order by created_at, id
        )::text,
        3,
        '0'
      ) as new_code
  from public.customers
)
update public.customers c
   set code = o.new_code
  from ordered o
 where c.id = o.id;

-- 교육원 — TC + YYMM + 월별 순번 3자리
with ordered as (
  select
    id,
    'TC' ||
      to_char((created_at at time zone 'Asia/Seoul')::date, 'YYMM') ||
      lpad(
        row_number() over (
          partition by to_char((created_at at time zone 'Asia/Seoul')::date, 'YYMM')
          order by created_at, id
        )::text,
        3,
        '0'
      ) as new_code
  from public.training_centers
)
update public.training_centers tc
   set code = o.new_code
  from ordered o
 where tc.id = o.id;

-- 요양원 — CH + YYMM + 월별 순번 3자리
with ordered as (
  select
    id,
    'CH' ||
      to_char((created_at at time zone 'Asia/Seoul')::date, 'YYMM') ||
      lpad(
        row_number() over (
          partition by to_char((created_at at time zone 'Asia/Seoul')::date, 'YYMM')
          order by created_at, id
        )::text,
        3,
        '0'
      ) as new_code
  from public.care_homes
)
update public.care_homes ch
   set code = o.new_code
  from ordered o
 where ch.id = o.id;

-- 재발급 이후에는 NULL 허용하지 않음
alter table public.customers       alter column code set not null;
alter table public.training_centers alter column code set not null;
alter table public.care_homes       alter column code set not null;

commit;
