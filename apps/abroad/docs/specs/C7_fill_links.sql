-- =====================================================================
--  C7 — 정보 입력 공개 링크 (유효기간 있는 토큰)
--
--  학생/대리인이 로그인 없이 토큰 URL(/fill/<token>) 로 정보 입력을 채울 수 있게 한다.
--  - 공개 경로/액션은 service-role 로 토큰 검증(만료·revoke) 후 동작 (RLS 우회)
--  - 센터 사용자는 자기 org 학생의 링크만 생성/조회/취소 (RLS)
-- =====================================================================

create table if not exists study_student_fill_links (
  token       uuid primary key default gen_random_uuid(),
  student_id  uuid not null references study_managed_students(id) on delete cascade,
  expires_at  timestamptz not null,
  revoked     boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_fill_links_student
  on study_student_fill_links (student_id);

alter table study_student_fill_links enable row level security;

-- 글로케어 어드민: 전체
drop policy if exists fill_links_admin_all on study_student_fill_links;
create policy fill_links_admin_all on study_student_fill_links
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'glocare_admin');

-- 유학센터 사용자: 자기 org 학생의 링크만
drop policy if exists fill_links_center_user on study_student_fill_links;
create policy fill_links_center_user on study_student_fill_links
  for all
  using (
    student_id in (
      select id from study_managed_students
      where org_id in (select study_my_org_ids())
    )
  )
  with check (
    student_id in (
      select id from study_managed_students
      where org_id in (select study_my_org_ids())
    )
  );
