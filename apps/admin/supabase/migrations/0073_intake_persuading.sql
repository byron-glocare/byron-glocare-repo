-- 영업직원용: 접수 '등록' 결정에 "설득" 상태 추가.
--   기존 3-state(예=intake_confirmed / 아니오=intake_abandoned / 미선택)에
--   4번째 옵션 "설득"을 더한다. 프로세스에는 영향 없음(미선택과 동일 취급) —
--   영업 화면에서 설득 중인 고객을 상단에 모아 보기 위한 표식 용도.
alter table public.customer_statuses
  add column if not exists intake_persuading boolean not null default false;

comment on column public.customer_statuses.intake_persuading is
  '영업 설득 중 표식. 프로세스 무영향(등록 미선택과 동일). 영업 화면 상단 노출용.';
