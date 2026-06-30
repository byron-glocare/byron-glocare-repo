-- 서술형(자기소개서·학업계획서) 문서 설정.
--   양식을 '서술형'으로 마킹 + 서술형 섹션(문항) 목록.
--   각 섹션 = { id, label, prompt(작성지침), basis_keys(AI 작성 기반 표준데이터 키들) }.
--   학생이 basis_keys 표준데이터를 입력 → 그 값으로 AI 초안 작성 → docx 서술형 칸에 채움.
--   (옛 essay_questions(질문/하위질문 구조)는 폐기 — 컬럼은 보존하되 더 이상 사용 안 함.)
alter table public.study_admission_form_files
  add column if not exists is_essay boolean not null default false,
  add column if not exists essay_sections jsonb not null default '[]'::jsonb;
