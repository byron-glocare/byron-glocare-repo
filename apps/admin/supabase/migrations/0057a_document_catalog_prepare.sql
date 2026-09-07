-- =============================================================================
-- 0057a: 표준 발급서류 카탈로그 정리 — 1단계 (준비)
--
--   ⚠ 이 파일을 먼저 실행하고, 성공하면 0057b 를 실행한다.
--
--   왜 두 개로 나눴나:
--     Supabase SQL 에디터는 붙여넣은 스크립트 **전체를 한 번에 파싱**한 뒤 실행한다.
--     그래서 같은 스크립트 안에서 CREATE TABLE 한 것을 뒤 문장이 참조하면
--     "relation ... does not exist" 로 파싱 단계에서 죽는다(실제로 두 번 겪음).
--     매핑 테이블을 앞 스크립트에서 실재하게 만들어 두면 0057b 파싱이 통과한다.
--
--   이 파일이 하는 일 (읽기+생성만 — 기존 데이터를 바꾸지 않는다):
--     1. 백업 스냅샷 (_backup_0057_*)  — 이미 있으면 다시 만들지 않는다
--     2. 병합 매핑 테이블 (_doc_merge_0057)
--     3. 오매핑 수정 테이블 (_doc_fix_0057)
--
--   여러 번 돌려도 안전하다. 백업은 최초 원본을 보존하고, 매핑 테이블은 내용이
--   고정이라 다시 만들어도 같다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 백업 — 이미 있으면 만들지 않는다 (재실행 시 원본이 덮이지 않게)
-- -----------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public._backup_0057_types') is null then
    create table public._backup_0057_types as
      select id, key, label_ko, aliases, is_active from public.study_student_data_types;
    raise notice '0057a: _backup_0057_types 생성';
  else
    raise notice '0057a: _backup_0057_types 이미 있음 - 보존';
  end if;

  if to_regclass('public._backup_0057_specs') is null then
    create table public._backup_0057_specs as
      select id, required_documents from public.study_admission_specs;
    raise notice '0057a: _backup_0057_specs 생성';
  else
    raise notice '0057a: _backup_0057_specs 이미 있음 - 보존';
  end if;

  if to_regclass('public._backup_0057_forms') is null then
    create table public._backup_0057_forms as
      select id, required_data_type_keys, slot_mapping, field_overlays, essay_sections
        from public.study_admission_form_files;
    raise notice '0057a: _backup_0057_forms 생성';
  else
    raise notice '0057a: _backup_0057_forms 이미 있음 - 보존';
  end if;

  -- study_required_submissions 는 "제출서류 → 모집요강 통합" 이후 운영 DB 에서 사라졌다.
  -- 남아 있는 환경에서만 백업한다.
  if to_regclass('public.study_required_submissions') is not null
     and to_regclass('public._backup_0057_subs') is null then
    create table public._backup_0057_subs as
      select id, std_key, required_data_type_keys from public.study_required_submissions;
    raise notice '0057a: _backup_0057_subs 생성';
  end if;
end
$do$;

-- -----------------------------------------------------------------------------
-- 2. 병합 매핑 — 흡수될 키 → 정본 키
--    정본 = 참조가 가장 많고 의미가 가장 포괄적인 것.
-- -----------------------------------------------------------------------------
drop table if exists public._doc_merge_0057;
create table public._doc_merge_0057(old_key text primary key, new_key text not null);

insert into public._doc_merge_0057(old_key, new_key) values
  -- 여권 사본 → document_passport_copy (specs 10 / forms 9)
  ('doc_1q6bm7m',  'document_passport_copy'),  -- 여권 또는 외국인등록증
  ('doc_6z62j8',   'document_passport_copy'),  -- 학생의 여권
  ('doc_1r73k22',  'document_passport_copy'),  -- 여권 사본 또는 외국인 등록증 사본 (미사용)
  ('doc_1im8sam',  'document_passport_copy'),  -- 본인 여권사본 및 정부기관 발행 서류 (미사용)

  -- 부모 신분증·여권 → doc_1mr8dkd (가장 포괄적: "부모님의 여권 또는 신분증")
  --   아버지/어머니 구분은 required_documents.target_person 이 이미 한다 → 표준은 하나면 된다.
  ('doc_jlqza4',   'doc_1mr8dkd'),  -- 부모의 여권 사본
  ('doc_uqbacc',   'doc_1mr8dkd'),  -- 부모의 신분증 혹은 여권 사본
  ('doc_kew4fg',   'doc_1mr8dkd'),  -- 어머니의 신분증 혹은 여권
  ('doc_16o8gt',   'doc_1mr8dkd'),  -- 부모 신분증 사본
  ('doc_1hu6w4o',  'doc_1mr8dkd'),  -- 아버지의 신분증 혹은 여권
  ('doc_11nzvqa',  'doc_1mr8dkd'),  -- 전 가족의 신분증 사본

  -- 가족관계 → document_family_cert (forms 7 이 이미 참조 중)
  --   베트남 학생이 실제로 내는 물건은 호적(So ho khau) / CT07 하나다.
  ('doc_11j9l',    'document_family_cert'),  -- 호적
  ('doc_129t96t',  'document_family_cert'),  -- 호적 또는 CT07
  ('doc_1u6k0bl',  'document_family_cert'),  -- 가족 호적 등본

  -- TOPIK 성적표 → document_topik_cert (TOPIK 을 콕 집어 요구하는 것)
  ('doc_106ptge',  'document_topik_cert'),   -- 어학능력 증빙자료 (TOPIK 2급 이상)
  ('doc_1hi8hx3',  'document_topik_cert'),   -- TOPIK 성적표, 세종학당 중급 1 (미사용)

  -- 한국어능력 입증(대체경로 허용) → doc_17us1kp
  --   TOPIK 성적표와 분리 유지 — 학생이 준비하는 물건이 다르다.
  --   (eligibility.korean_proficiency.alternative_paths 와 같은 구분)
  ('doc_1sws689',  'doc_17us1kp'),  -- TOPIK / KIIP / 세종학당
  ('doc_1i6wx23',  'doc_17us1kp'),  -- 세종학당 한국어 / KIIP
  ('doc_noagbl',   'doc_17us1kp'),  -- 한국어능력자격증

  -- 소득증명 → doc_sy19uf ("보호자의 소득 증명서")
  ('doc_nc248j',   'doc_sy19uf'),   -- 부모의 소득 증명서

  -- 사진 → document_photo (규격은 서류가 아니라 요구사항 → notes 로)
  ('doc_od85wh',   'document_photo'),  -- 증명사진 (3.5 X 4.5cm)

  -- 어학연수생(국내 D-4 → D-2 경로) 서류
  ('doc_x7z25e',   'doc_1vnuei3'),  -- 수료증 또는 재학증명 (미사용)
  ('doc_j0rtse',   'doc_c7iku');    -- 한국어학연수 성적 (미사용)

-- -----------------------------------------------------------------------------
-- 3. 명백한 오매핑 — A key 와 std_key 가 서로 다른 서류를 가리키는 것
--    (판단이 갈리는 nationality_proof / financial_proof / korean_proof 는 제외)
-- -----------------------------------------------------------------------------
drop table if exists public._doc_fix_0057;
create table public._doc_fix_0057(a_key text, wrong_std text, right_std text);

insert into public._doc_fix_0057 values
  -- 성적증명서인데 졸업증명서에 붙음 (1건)
  ('highschool_transcript',        'document_highschool_diploma', 'document_highschool_transcript'),
  -- 가족관계증명서인데 출생증명서에 붙음 (5건)
  ('family_relations_certificate', 'document_birth_cert',         'document_family_cert'),
  -- 여권사본인데 부모 신분증에 붙음 (1건 — 0057b 병합으로 doc_1mr8dkd 가 된 뒤)
  ('passport_copy',                'doc_1mr8dkd',                 'document_passport_copy');

-- =============================================================================
-- 확인 — 22 / 3 이 나오면 0057b 로 진행
-- =============================================================================
select
  (select count(*) from public._doc_merge_0057) as merge_rows,   -- 22
  (select count(*) from public._doc_fix_0057)   as fix_rows,     -- 3
  (select count(*) from public._backup_0057_types) as backup_types,
  (select count(*) from public._backup_0057_specs) as backup_specs,
  (select count(*) from public._backup_0057_forms) as backup_forms;
