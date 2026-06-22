-- =============================================================================
-- 0035: 유학센터(study_centers) ↔ 로그인 회사(study_center_orgs) 연결 + 어드민 계정 시드
--
-- 배경(운영자 결정 2026-06-19):
--   - "유학센터" 메뉴(study_centers, int id)가 운영자가 관리하는 master 목록.
--     (VLedu, QUANG TRUNG, Glocare ...)
--   - 로그인 계정(study_center_users)은 구조상 study_center_orgs(uuid)에만 FK.
--   → study_center_orgs 에 study_center_id 링크를 추가해 둘을 잇는다.
--     계정 만들기 화면은 study_centers 를 보여주고, 선택 시 대응 org 를 자동 생성·연결.
--
--   - 어드민 계정 4명을 모두 "Glocare" 유학센터의 (센터)계정으로도 오픈.
--   - 테스트용 "Trung tâm Test Hà Nội" org 는 삭제.
--
-- 멱등: 여러 번 실행해도 안전.
-- =============================================================================

-- 1) org ↔ study_center 링크 컬럼
alter table public.study_center_orgs
  add column if not exists study_center_id bigint
    references public.study_centers(id);

create index if not exists idx_study_center_orgs_study_center
  on public.study_center_orgs(study_center_id);

-- 2) Glocare org 보장 + 어드민 전원 연결 + 하노이 테스트 삭제
do $$
declare
  v_center_id bigint;
  v_org_id    uuid;   -- Glocare org
  v_hanoi_id  uuid;   -- 삭제할 테스트 org
begin
  -- Glocare study_center 찾기
  select id into v_center_id
  from public.study_centers
  where name_vi ilike '%glocare%' or name_ko ilike '%glocare%'
  order by id
  limit 1;

  if v_center_id is null then
    raise exception '유학센터 목록에 Glocare 가 없습니다. (study_centers)';
  end if;

  -- Glocare 에 대응하는 org 가 없으면 생성
  select id into v_org_id
  from public.study_center_orgs
  where study_center_id = v_center_id
  limit 1;

  if v_org_id is null then
    insert into public.study_center_orgs
      (name_vi, name_ko, country, status, settlement_currency,
       study_center_id, activated_at)
    select
      coalesce(sc.name_vi, 'Glocare'),
      coalesce(sc.name_ko, '글로케어'),
      'VN', 'active', 'KRW', v_center_id, now()
    from public.study_centers sc
    where sc.id = v_center_id
    returning id into v_org_id;
  end if;

  -- 어드민(glocare_admin) 전원을 Glocare org 의 센터 계정으로 (upsert)
  insert into public.study_center_users
    (org_id, auth_user_id, email, name, role, status)
  select
    v_org_id, u.id, u.email,
    coalesce(nullif(split_part(u.email, '@', 1), ''), 'admin'),
    'admin', 'active'
  from auth.users u
  where u.raw_app_meta_data ->> 'role' = 'glocare_admin'
  on conflict (auth_user_id) do update
    set org_id = excluded.org_id,
        status = 'active',
        role   = 'admin';

  -- 테스트용 하노이 org 정리: 의존 데이터를 Glocare 로 이관/삭제 후 org 삭제.
  --   (study_managed_students 가 FK RESTRICT 라 그냥 삭제 불가)
  select id into v_hanoi_id
  from public.study_center_orgs
  where name_vi ilike '%Test Hà Nội%' and study_center_id is null
  limit 1;

  if v_hanoi_id is not null then
    -- 학생은 Glocare org 로 이관 (byron 의 테스트 학생 → 이제 Glocare 소속)
    update public.study_managed_students
      set org_id = v_org_id
    where org_id = v_hanoi_id;
    -- 테스트 인보이스/센터유저 정리
    delete from public.study_invoices       where org_id = v_hanoi_id;
    delete from public.study_center_users   where org_id = v_hanoi_id;
    -- org 삭제
    delete from public.study_center_orgs    where id = v_hanoi_id;
  end if;
end $$;

-- 확인용:
-- select o.name_ko, o.name_vi, o.study_center_id, count(cu.id) as users
-- from study_center_orgs o
-- left join study_center_users cu on cu.org_id = o.id
-- group by o.id order by o.created_at;
