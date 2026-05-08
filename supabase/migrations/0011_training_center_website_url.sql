-- 교육원 웹사이트 링크 컬럼 추가
alter table public.training_centers
  add column if not exists website_url text;
