-- =============================================================================
-- 0060: 서류 항목 구조 — 새 테이블 3개 + 기존 데이터 복사 (추가만, 삭제 없음)
--
-- 운영자 결정 (2026-09-15):
--   · 서류 정의는 한 곳(서류 카탈로그)에만 둔다. 모집요강은 복사하지 않고 참조만.
--   · 대학이 고르는 단위는 "서류 항목"이고, 실제 문서("서류")는 항목 안에만 있다.
--     서류 1개짜리 항목이 대부분이라 화면에선 서류처럼 보이지만, 나중에 어느 나라에서
--     그 서류가 둘로 갈라져도(라오스 통장사본 예) 항목에 구성만 추가하면 된다.
--   · 항목의 구성 = "칸들은 모두 필요, 칸 안에서는 하나만". 칸 선택지는 서류 또는 다른 항목.
--     구성은 조건(국적, 재정보증인 유형)별로 통째로 둔다. 조건 축은 이 둘로 고정.
--   · 대학별 차이는 종속이다. 유효기간·인증 같은 조건은 입력칸으로 빼서 그것만 덮어쓴다.
--     안내문은 모집요강별로 통째로 덮어쓴다(둘 다 보여주면 헷갈림 — 운영자 결정).
--   · 데이터 탭의 서류 항목은 이 구조로 옮긴 뒤 **삭제**한다(비활성화 아님). 이 파일은
--     옮기기까지만 하고 삭제는 코드 전환·검증 후 별도 파일로.
--
-- 이 파일이 하는 일:
--   1) 테이블 3개 생성 + RLS
--   2) 데이터 탭의 서류(category=document) → 서류 카탈로그 복사. **키 그대로** —
--      학생이 올린 파일·양식 슬롯이 그 키에 붙어 있다.
--   3) 서류마다 서류 1개짜리 항목 자동 생성 (item_<서류키>).
--      대상자가 붙은 서류(아버지/어머니)는 대상자별 항목도 만든다 (item_<서류키>__father).
--   4) 모집요강 14건의 서류를 요강↔항목 행으로 변환. 표준에 연결된 것만 자동이고,
--      연결 안 된 것은 그대로 남겨 연결 UI 에서 운영자가 고른다.
--
-- 안전: 기존 테이블·컬럼을 바꾸지 않는다. 여러 번 돌려도 같은 결과(on conflict do nothing).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 테이블
-- -----------------------------------------------------------------------------

-- 서류 — 실제로 떼는 문서. 키는 기존 표준데이터 키를 그대로 이어받는다.
create table if not exists public.study_doc_standards (
  key                  text primary key,
  name_ko              text not null,
  name_vi              text,
  is_form_doc          boolean not null default false,      -- 작성서류(학교 양식) / 발급서류
  issuing_country      text,                                -- 'vn' 등. null = 범용
  issuer_ko            text,
  issuer_vi            text,
  -- 대학마다 자주 달라지는 조건 — 입력칸으로 뺀 것 (안내문에 숫자를 적지 않는다)
  validity_days        integer,                             -- 유효기간 (발급일부터 며칠)
  notarization         text check (notarization is null or notarization in (
                         'none','translation_notarization','consul','consul_for_vietnam',
                         'apostille','apostille_or_consul')),
  original_required    boolean,                             -- 원본 필수 여부 (null=상관없음)
  issued_within_days   integer,                             -- 발급 후 며칠 이내
  guide_ko             text,                                -- 기본 안내문
  guide_vi             text,
  aliases              text[] not null default '{}',        -- AI 매칭용 다른 표기
  data_type_keys       text[] not null default '{}',        -- 이 서류에 담긴 입력 항목(데이터 탭 키)
  sort_order           integer not null default 0,
  is_active            boolean not null default true,
  created_at           timestamptz not null default timezone('utc', now()),
  updated_at           timestamptz not null default timezone('utc', now())
);
comment on table public.study_doc_standards is
  '서류 카탈로그(정본). 실제로 떼는 문서 하나 = 행 하나. 모집요강은 복사하지 않고 항목을 통해 참조한다.';

-- 서류 항목 — 대학이 고르는 단위. 구성(variants)은 통째로 편집하는 덩어리라 JSONB.
--   variants: [
--     { "when": null | {"nationality":"vn"} | {"sponsor":"relative"} | {"nationality":"vn","sponsor":"relative"},
--       "slots": [ { "target": null|"self"|"father"|"mother"|"sponsor",
--                    "options": [ {"standard":"<서류키>"} | {"item":"<항목키>"} ] } ] }
--   ]
--   규칙: 칸(slots)은 모두 필요, 칸 안(options)에서는 하나만. when=null 이 기본 구성.
create table if not exists public.study_doc_items (
  key          text primary key,
  name_ko      text not null,
  name_vi      text,
  guide_ko     text,
  guide_vi     text,
  variants     jsonb not null default '[]'::jsonb,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);
comment on table public.study_doc_items is
  '서류 항목 = 대학이 모집요강에서 고르는 단위. 조건(국적·재정보증인)별 구성으로 실제 서류에 연결된다.';

-- 모집요강 ↔ 서류 항목. 지금의 specs.required_documents JSONB 를 대체할 자리.
create table if not exists public.study_spec_doc_items (
  id                 uuid primary key default gen_random_uuid(),
  spec_id            uuid not null references public.study_admission_specs(id) on delete cascade,
  item_key           text not null references public.study_doc_items(key) on delete restrict,
  required           boolean not null default true,
  sort_order         integer not null default 0,
  -- 안내문 덮어쓰기 — 있으면 표준 안내문 대신 이것만 보여준다
  guide_override_ko  text,
  guide_override_vi  text,
  -- 종속 설정 — 표준과 다른 부분만. 나머지는 계속 표준을 따라간다.
  --   { "standards": { "<서류키>": { "validity_days": 730, "notarization": "consul", ... } },
  --     "allowed_options": ["<서류키>", ...] }   -- 칸 선택지를 이 대학은 이것만으로 좁힘
  overrides          jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now()),
  unique (spec_id, item_key)
);
create index if not exists idx_spec_doc_items_spec on public.study_spec_doc_items(spec_id);
create index if not exists idx_spec_doc_items_item on public.study_spec_doc_items(item_key);

-- updated_at
do $do$
declare t text;
begin
  for t in select unnest(array['study_doc_standards','study_doc_items','study_spec_doc_items']) loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$do$;

-- RLS — 기존 표준데이터와 같은 결: 인증 사용자 전체, 익명은 활성 카탈로그 읽기만
alter table public.study_doc_standards  enable row level security;
alter table public.study_doc_items      enable row level security;
alter table public.study_spec_doc_items enable row level security;
do $do$
declare t text;
begin
  for t in select unnest(array['study_doc_standards','study_doc_items','study_spec_doc_items']) loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_full', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_authenticated_full', t);
  end loop;
end
$do$;
drop policy if exists study_doc_standards_anon_read on public.study_doc_standards;
create policy study_doc_standards_anon_read on public.study_doc_standards for select to anon using (is_active);
drop policy if exists study_doc_items_anon_read on public.study_doc_items;
create policy study_doc_items_anon_read on public.study_doc_items for select to anon using (is_active);

-- -----------------------------------------------------------------------------
-- 2. 서류 카탈로그 채우기 — 데이터 탭의 서류를 키 그대로 복사
-- -----------------------------------------------------------------------------
insert into public.study_doc_standards
  (key, name_ko, name_vi, is_form_doc, guide_ko, guide_vi, aliases, sort_order, is_active)
select key, label_ko, nullif(label_vi, ''), is_form_doc, hint_ko, hint_vi,
       coalesce(aliases, '{}'), sort_order, is_active
  from public.study_student_data_types
 where category = 'document'
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 3. 서류 1개짜리 항목 자동 생성
--    item_<서류키>            대상자 없음
--    item_<서류키>__father 등  요강에서 그 대상자로 쓰인 서류만 (부모 신분증 등)
-- -----------------------------------------------------------------------------
insert into public.study_doc_items (key, name_ko, name_vi, variants, sort_order, is_active)
select 'item_' || s.key, s.name_ko, s.name_vi,
       jsonb_build_array(jsonb_build_object(
         'when', null,
         'slots', jsonb_build_array(jsonb_build_object(
           'target', null,
           'options', jsonb_build_array(jsonb_build_object('standard', s.key))
         ))
       )),
       s.sort_order, s.is_active
  from public.study_doc_standards s
on conflict (key) do nothing;

-- 대상자별 항목 — 요강에서 실제로 쓰인 (서류키, 대상자) 조합만
insert into public.study_doc_items (key, name_ko, name_vi, variants, sort_order, is_active)
select distinct on (s.key, d.target)
       'item_' || s.key || '__' || d.target,
       s.name_ko || ' (' || case d.target when 'father' then '아버지' when 'mother' then '어머니'
                                          when 'other' then '기타' else d.target end || ')',
       case when s.name_vi is null then null
            else s.name_vi || ' (' || case d.target when 'father' then 'bố' when 'mother' then 'mẹ'
                                                    when 'other' then 'khác' else d.target end || ')' end,
       jsonb_build_array(jsonb_build_object(
         'when', null,
         'slots', jsonb_build_array(jsonb_build_object(
           'target', d.target,
           'options', jsonb_build_array(jsonb_build_object('standard', s.key))
         ))
       )),
       s.sort_order, s.is_active
  from public.study_doc_standards s
  join (
    select x->>'std_key' as std_key, x->>'target_person' as target
      from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
     where x->>'std_key' is not null and x->>'std_key' <> '__none__'
       and coalesce(x->>'target_person','') not in ('', 'self')
  ) d on d.std_key = s.key
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 4. 모집요강 서류 → 요강↔항목 행
--    · std_key 있는 것만. 대상자 있으면 대상자별 항목으로.
--    · notes 는 대학이 적은 안내문이므로 guide_override 로.
--    · notarization 은 종속 설정(overrides.standards)으로.
--    · 같은 요강에 같은 (서류, 대상자)가 두 번 있으면 앞의 것만 남는다 — 0059 검토 쿼리 참고.
-- -----------------------------------------------------------------------------
insert into public.study_spec_doc_items
  (spec_id, item_key, required, sort_order, guide_override_ko, overrides)
select sp.id,
       'item_' || (x->>'std_key')
         || case when coalesce(x->>'target_person','') not in ('', 'self')
                 then '__' || (x->>'target_person') else '' end,
       coalesce((x->>'required')::boolean, true),
       ord::integer,
       nullif(btrim(x->>'notes'), ''),
       case when nullif(btrim(x->>'notarization'), '') is not null
            then jsonb_build_object('standards', jsonb_build_object(
                   x->>'std_key', jsonb_build_object('notarization', x->>'notarization')))
            else '{}'::jsonb end
  from public.study_admission_specs sp,
       jsonb_array_elements(sp.required_documents) with ordinality as e(x, ord)
 where x->>'std_key' is not null and x->>'std_key' <> '__none__'
   and exists (select 1 from public.study_doc_items i
                where i.key = 'item_' || (x->>'std_key')
                  || case when coalesce(x->>'target_person','') not in ('', 'self')
                          then '__' || (x->>'target_person') else '' end)
on conflict (spec_id, item_key) do nothing;

-- =============================================================================
-- 확인
-- =============================================================================
select
  (select count(*) from public.study_doc_standards)   as standards,     -- 데이터 탭 서류 수와 같아야
  (select count(*) from public.study_doc_items)       as items,
  (select count(*) from public.study_spec_doc_items)  as spec_items,
  -- 표준에 연결 안 돼 옮기지 못한 요강 서류 — 연결 UI 에서 운영자가 처리
  (select count(*) from public.study_admission_specs sp, jsonb_array_elements(sp.required_documents) x
    where coalesce(x->>'std_key','') in ('', '__none__')) as unlinked_spec_docs;
