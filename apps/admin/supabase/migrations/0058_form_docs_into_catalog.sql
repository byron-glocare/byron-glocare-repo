-- =============================================================================
-- 0058: 작성서류(학교 양식)를 표준 카탈로그에 편입 + is_form_doc 플래그
--
-- 배경:
--   0057 로 정리한 카탈로그 25개는 **전부 발급서류**다. 입학원서·자기소개서 같은
--   "학교 양식에 채워 내는 서류"는 카탈로그에 아예 없다. 지금까지 그것들이
--   하드코딩 enum(KEY_OPTIONS / studentDocumentTypeEnum)에만 있었고,
--   required-documents-field 가 작성서류의 std_key 를 아예 null 로 비웠기 때문이다.
--
--   운영자 드롭다운을 카탈로그로 바꾸려면(= A enum 을 AI 전용으로 되돌리려면)
--   작성서류도 카탈로그에 있어야 한다.
--
-- 하는 일:
--   1. study_student_data_types.is_form_doc 컬럼 추가
--      → 작성/발급 분류를 코드 하드코딩(FORM_DOC_KEYS)에서 데이터로 이관
--   2. 기존 25개 발급서류를 is_form_doc=false 로 확정 (기본값 그대로)
--   3. 작성서류 7종 시드 (is_form_doc=true)
--
-- 안전:
--   · 컬럼 추가 + INSERT 만. 기존 행을 수정하지 않는다.
--   · 시드 키는 고정이라 여러 번 돌려도 중복되지 않는다 (on conflict do nothing).
--   · 이 시드 키들은 **고정 식별자**다. 라벨은 바꿔도 되지만 키는 바꾸지 않는다.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. is_form_doc — 이 서류가 "학교 양식에 채워 내는 것"인지
--    false(기본) = 발급받아 제출하는 것.
-- -----------------------------------------------------------------------------
alter table public.study_student_data_types
  add column if not exists is_form_doc boolean not null default false;

comment on column public.study_student_data_types.is_form_doc is
  '작성서류(학교 양식에 채워 제출) 여부. false=발급서류. category=document 에서만 의미 있음. '
  '코드의 FORM_DOC_KEYS 하드코딩을 대체한다.';

create index if not exists idx_data_types_form_doc
  on public.study_student_data_types (category, is_form_doc)
  where is_active;

-- -----------------------------------------------------------------------------
-- 2. 작성서류 시드
--    aliases 에 흔한 다른 표기를 미리 넣어둔다 — AI 추출·자동매칭이 새 표준을
--    또 만들지 않게 하는 것이 이 컬럼의 목적이다.
-- -----------------------------------------------------------------------------
insert into public.study_student_data_types
  (key, label_ko, label_vi, category, input_type, is_form_doc, aliases, sort_order, is_active)
values
  ('doc_form_application',      '입학원서',
   'Đơn xin nhập học',            'document', 'file', true,
   array['입학지원서','지원서','원서','입학신청서','Application Form'], 810, true),

  ('doc_form_self_intro',       '자기소개서',
   'Bản giới thiệu bản thân',     'document', 'file', true,
   array['자기소개','자소서','Self Introduction'], 820, true),

  ('doc_form_study_plan',       '학업계획서',
   'Kế hoạch học tập',            'document', 'file', true,
   array['수학계획서','학습계획서','Study Plan'], 830, true),

  ('doc_form_financial_pledge', '재정보증서',
   'Giấy bảo lãnh tài chính',     'document', 'file', true,
   array['재정보증각서','재정보증 확약서','Financial Pledge'], 840, true),

  ('doc_form_privacy_consent',  '개인정보 수집·이용 동의서',
   'Giấy đồng ý cung cấp thông tin cá nhân', 'document', 'file', true,
   array['개인정보 동의서','개인정보제공동의서','Privacy Consent'], 850, true),

  ('doc_form_record_release',   '학적정보 제공 동의서',
   'Giấy đồng ý cung cấp thông tin học tập', 'document', 'file', true,
   array['학력조회 동의서','학적조회 동의서','Academic Record Release'], 860, true),

  ('doc_form_recommendation',   '추천서',
   'Thư giới thiệu',              'document', 'file', true,
   array['교사추천서','지도교사 추천서','Recommendation Letter'], 870, true)

on conflict (key) do nothing;

-- =============================================================================
-- 확인 — 작성 7 / 발급 25 가 나오면 정상
-- =============================================================================
select
  count(*) filter (where is_form_doc)       as form_docs,    -- 7
  count(*) filter (where not is_form_doc)   as issued_docs   -- 25
  from public.study_student_data_types
 where category = 'document' and is_active;

-- 전체 목록
-- select key, label_ko, is_form_doc, coalesce(array_length(aliases,1),0) as n_alias
--   from study_student_data_types
--  where category='document' and is_active
--  order by is_form_doc desc, sort_order, label_ko;
