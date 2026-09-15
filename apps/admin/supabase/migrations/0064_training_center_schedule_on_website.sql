-- 교육원: 모집(개강) 일정을 자체 홈페이지에서 확인 가능한지 여부.
--   true 이면 강의 정보 문의 문자를 굳이 보낼 필요가 없다 (홈페이지에서 확인 가능).
--   강의 정보 문의 리스트에 컬럼으로 노출된다.
alter table public.training_centers
  add column if not exists schedule_on_website boolean not null default false;

comment on column public.training_centers.schedule_on_website is
  '개강 일정을 교육원 자체 홈페이지에서 확인 가능. true면 강의 정보 문의 문자 불필요.';
