-- =============================================================================
-- 0067c: 0067b 가 학과에 못 붙인 현행 양식 2개 붙이기
--
-- 0067b 는 옛 요강 JSONB 에 같은 종류의 작성서류가 적혀 있는 학과에만 양식을 붙였다.
-- 요강에 그 서류가 안 적혀 있던 두 대학의 양식이 남았다(current_forms_without_dept = 2):
--   · 호산대 "자기소개서 학업계획"(self_intro) → 일반학과 2개 (K-보건케어전공 원본 행, 자동차조선전공 복사 행)
--   · 서정대 "목포과학대 입학원서"(application_form) → 글로벌요양복지과
-- 여러 번 돌려도 같다(이미 붙은 행은 건너뛴다).
-- =============================================================================

-- 호산대 자기소개서 → K-보건케어전공 (원본 행)
update public.study_admission_form_files
   set spec_department_id = '8fb04520-65ed-4d1a-8ee2-c98390d2687b', updated_at = timezone('utc', now())
 where id = '2fc89498-a104-48eb-b409-6e14e773125b' and spec_department_id is null;

-- 호산대 자기소개서 → 자동차조선전공 (같은 파일을 가리키는 복사 행)
insert into public.study_admission_form_files
  (university_id, department_name, key, name_ko, file_url, file_name, size_bytes, mime_type, is_current, uploaded_by, uploaded_at,
   notes, required_data_type_keys, essay_questions, applies_to_terms, applies_to_department_ids, spec_department_id,
   field_overlays, label_mapping, slot_mapping, is_essay, essay_sections)
select university_id, department_name, key, name_ko, file_url, file_name, size_bytes, mime_type, true, uploaded_by, uploaded_at,
       notes, required_data_type_keys, essay_questions, applies_to_terms, applies_to_department_ids, 'fd337bf0-2889-466d-8d06-70a4dc44c051',
       field_overlays, label_mapping, slot_mapping, is_essay, essay_sections
  from public.study_admission_form_files
 where id = '2fc89498-a104-48eb-b409-6e14e773125b'
   and not exists (select 1 from public.study_admission_form_files
                    where spec_department_id = 'fd337bf0-2889-466d-8d06-70a4dc44c051' and key = 'self_intro' and is_current);

-- 서정대 입학원서 → 글로벌요양복지과
update public.study_admission_form_files
   set spec_department_id = 'bf22683a-66f3-41e0-b343-67a88d98a088', updated_at = timezone('utc', now())
 where id = 'e56130dc-07b7-44cb-b529-bd2745f09df7' and spec_department_id is null;

-- 확인 — 0 이어야 한다
select count(*) as current_forms_without_dept
  from public.study_admission_form_files
 where is_current and spec_department_id is null;
