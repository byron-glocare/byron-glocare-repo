-- =============================================================================
-- 0066: 군장대 일반학과(D-2) 입학지원서 복구 + 어학연수 양식을 학과·학기로 분리
--
-- 사고(2026-09-16 13:51 KST): 어학연수(2026-Winter) 요강용 입학원서를 올리자
--   일반학과(2027-Spring) 요강이 쓰던 입학지원서가 현행에서 밀려났다.
--   양식 파일의 버전 묶음이 (대학, 종류, department_name) 이고 두 요강 다 department_name
--   이 null 이라 같은 묶음으로 취급됐기 때문이다. 파일과 슬롯 배치(67칸)는 그대로 남아 있다.
--
-- 하는 일 (군장대 university_id=8):
--   1) 오늘 올린 어학연수 양식 4개(입학원서·개인정보동의서·자기소개서·수학계획서)를
--      department_name='한국어학연수'(departments.id=64), 적용 학기 2026-Winter 로 분리.
--      어학연수 입학원서는 이름도 요강의 서류명("입학신청서")에 맞춘다.
--   2) 일반학과 입학지원서(ebe5a156, 2026-08-12 업로드, 슬롯 67칸) 를 다시 현행으로.
--      적용 학기 2027-Spring, 적용 학과 글로벌케어과(57)·조선전공(58).
--
-- 순서가 중요하다: 현행 양식에는 유일 인덱스 uniq_study_form_files_current
--   (university_id, coalesce(department_name,''), key) 가 있어서, 어학연수 입학원서의
--   department_name 을 먼저 바꿔 놓지 않으면 2) 에서 "duplicate key" 로 실패한다.
--   (첫 시도가 그렇게 실패했다 — 2026-09-16.)
--
-- 안전: 지정한 행만 갱신. 파일·슬롯·서술형 설정은 건드리지 않는다. 여러 번 돌려도 같다.
-- =============================================================================

-- 1. 어학연수 양식 분리 (현행 4개 + 오늘 올렸다가 밀린 옛 버전 4개도 같은 묶음으로)
update public.study_admission_form_files
   set department_name = '한국어학연수',
       applies_to_terms = '{2026-Winter}',
       applies_to_department_ids = '{64}',
       updated_at = timezone('utc', now())
 where university_id = 8
   and id in (
     '474f211e-0992-4670-ae2d-de40137cbe58',  -- 입학원서 (현행)
     '3e2de009-5db1-4494-a505-72315e5735b6',  -- 입학원서 (13:51 첫 업로드, 밀림)
     '8254144f-1bf3-4380-b6fa-963c5b00e366',  -- 개인정보 수집·이용 동의서
     'b6107a59-1a9b-4e84-b33e-db42831e4d39',  -- 자기소개서 (현행)
     'e33bf5b1-dbdf-4657-9e08-80f368ce52c8',  -- 자기소개서 (밀림)
     'ebc49010-466a-4476-a8e6-e5f6daadd2e4',  -- 수학계획서 (현행)
     '04b42767-011f-41a7-bc69-b5b536a6c723',  -- 수학계획서 (밀림)
     'b8b647e4-3e75-4a3b-b43b-2cb3f893f149'   -- 수학계획서 (밀림)
   );

update public.study_admission_form_files
   set name_ko = '입학신청서 (한국어 어학연수)',
       updated_at = timezone('utc', now())
 where id in ('474f211e-0992-4670-ae2d-de40137cbe58', '3e2de009-5db1-4494-a505-72315e5735b6')
   and university_id = 8;

-- 2. 일반학과 입학지원서 복구 (이제 같은 묶음에 현행이 없으므로 올릴 수 있다)
update public.study_admission_form_files
   set is_current = true,
       superseded_by = null,
       applies_to_terms = '{2027-Spring}',
       applies_to_department_ids = '{57,58}',
       updated_at = timezone('utc', now())
 where id = 'ebe5a156-ab04-4314-b288-cdff19ba4621'
   and university_id = 8;

-- 확인 — 군장대 현행 양식 5줄: application_form 2건(일반 null / 한국어학연수), 어학연수 3건
select id, key, name_ko, department_name, applies_to_terms, applies_to_department_ids, is_current,
       (slot_mapping is not null) as has_slots
  from public.study_admission_form_files
 where university_id = 8 and is_current
 order by key, department_name nulls first;
