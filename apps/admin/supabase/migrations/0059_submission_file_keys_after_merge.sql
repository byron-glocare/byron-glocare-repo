-- =============================================================================
-- 0059: 0057 병합에 맞춰 학생 업로드 파일 키(doc_key) 옮기기
--
-- 배경:
--   0057 이 표준 발급서류 22개를 정본으로 병합하면서 키가 박힌 9군데를 치환했는데,
--   **학생이 올린 파일(study_student_submission_files.doc_key)은 빠졌다.**
--   파일 키는 `std::<표준키>::<인증>` 꼴이라, 표준키가 바뀐 뒤엔 화면이 새 키로
--   찾고 파일은 옛 키로 남아 "올렸는데 안 올린 걸로" 보인다.
--
--   또 하나: 아버지 신분증(doc_1hu6w4o)과 어머니 신분증(doc_kew4fg)이 같은 표준
--   (doc_1mr8dkd)으로 합쳐지면서 두 칸의 파일 키가 같아졌다. 코드는 이제 대상자를
--   키에 붙인다(`std::doc_1mr8dkd::<인증>::father`). 옛 파일도 그에 맞춰 옮긴다 —
--   옛 표준키가 아버지/어머니를 말해주므로 정확히 붙일 수 있다.
--
-- 안전:
--   · 백업 테이블 먼저 (있으면 다시 만들지 않는다).
--   · `std::<옛키>::` 로 시작하는 행만 건드린다. 여러 번 돌려도 두 번 바뀌지 않는다.
--   · 옮긴 키가 이미 있으면(같은 학생이 새 키로 다시 올린 경우) 옛 행은 그대로 둔다 —
--     UNIQUE(student_id, doc_key) 충돌로 덮어쓰지 않기 위해.
-- =============================================================================

do $do$
begin
  if to_regclass('public._backup_0059_submission_files') is null then
    create table public._backup_0059_submission_files as
      select id, student_id, doc_key from public.study_student_submission_files;
    raise notice '0059: _backup_0059_submission_files 생성';
  end if;
end
$do$;

-- 매핑: 옛 표준키 → 새 표준키 (+ 대상자 접미사)
drop table if exists public._doc_key_map_0059;
create table public._doc_key_map_0059(old_key text primary key, new_key text not null, suffix text not null default '');
insert into public._doc_key_map_0059(old_key, new_key, suffix) values
  -- 여권 사본
  ('doc_1q6bm7m', 'document_passport_copy', ''),
  ('doc_6z62j8',  'document_passport_copy', ''),
  ('doc_1r73k22', 'document_passport_copy', ''),
  ('doc_1im8sam', 'document_passport_copy', ''),
  -- 부모 신분증·여권 — 아버지/어머니는 대상자 접미사를 붙인다
  ('doc_1hu6w4o', 'doc_1mr8dkd', '::father'),   -- 아버지의 신분증 혹은 여권
  ('doc_kew4fg',  'doc_1mr8dkd', '::mother'),   -- 어머니의 신분증 혹은 여권
  ('doc_jlqza4',  'doc_1mr8dkd', ''),           -- 부모의 여권 사본 (대상자 미구분)
  ('doc_uqbacc',  'doc_1mr8dkd', ''),
  ('doc_16o8gt',  'doc_1mr8dkd', ''),
  ('doc_11nzvqa', 'doc_1mr8dkd', ''),
  -- 가족관계
  ('doc_11j9l',   'document_family_cert', ''),
  ('doc_129t96t', 'document_family_cert', ''),
  ('doc_1u6k0bl', 'document_family_cert', ''),
  -- TOPIK / 한국어능력
  ('doc_106ptge', 'document_topik_cert', ''),
  ('doc_1hi8hx3', 'document_topik_cert', ''),
  ('doc_1sws689', 'doc_17us1kp', ''),
  ('doc_1i6wx23', 'doc_17us1kp', ''),
  ('doc_noagbl',  'doc_17us1kp', ''),
  -- 소득 / 사진 / 어학연수생
  ('doc_nc248j',  'doc_sy19uf', ''),
  ('doc_od85wh',  'document_photo', ''),
  ('doc_x7z25e',  'doc_1vnuei3', ''),
  ('doc_j0rtse',  'doc_c7iku', '');

-- doc_key = 'std::' || old_key || '::' || 인증 → 'std::' || new_key || '::' || 인증 || suffix
update public.study_student_submission_files f
   set doc_key = 'std::' || m.new_key || substr(f.doc_key, length('std::' || m.old_key) + 1) || m.suffix,
       updated_at = now()
  from public._doc_key_map_0059 m
 where f.doc_key like 'std::' || m.old_key || '::%'
   and not exists (
     select 1 from public.study_student_submission_files f2
      where f2.student_id = f.student_id
        and f2.doc_key = 'std::' || m.new_key || substr(f.doc_key, length('std::' || m.old_key) + 1) || m.suffix
   );

drop table public._doc_key_map_0059;

-- 확인 — 옛 키가 남아 있으면 0 이 아니다 (충돌로 못 옮긴 것; 학생이 새 키로 이미 올린 경우)
select count(*) as remaining_old_keys
  from public.study_student_submission_files
 where doc_key like 'std::doc_1q6bm7m::%' or doc_key like 'std::doc_6z62j8::%'
    or doc_key like 'std::doc_1hu6w4o::%' or doc_key like 'std::doc_kew4fg::%'
    or doc_key like 'std::doc_jlqza4::%'  or doc_key like 'std::doc_uqbacc::%'
    or doc_key like 'std::doc_11j9l::%'   or doc_key like 'std::doc_od85wh::%';

-- 검토 — 한 요강 안에서 같은 표준+같은 대상자를 두 번 쓰는 서류 (학생 화면에 하나만 남는다)
--   나오면 요강 편집에서 둘 중 하나를 다른 표준으로 바꾸거나 합친다. 새 구조(서류 항목)로
--   옮기면 구조적으로 사라지는 문제라 지금은 목록만 뽑는다.
-- select s.id as spec_id, u.name_ko as university, d->>'std_key' as std_key,
--        coalesce(d->>'target_person','') as target, string_agg(d->>'name_ko', ' / ') as names, count(*) as n
--   from study_admission_specs s
--   join universities u on u.id = s.university_id,
--        jsonb_array_elements(s.required_documents) d
--  where d->>'std_key' is not null and d->>'std_key' <> '__none__'
--  group by 1,2,3,4 having count(*) > 1
--  order by 2;
