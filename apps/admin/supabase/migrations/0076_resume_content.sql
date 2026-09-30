-- 이력서 HTML 편집기용 "완성 이력서" 저장 컬럼.
--   resume_drafts.data 는 학생이 제출한 원본(raw)이고,
--   resume_content 는 AI 정리 + 관리자 편집을 거친 최종 이력서(구조화 JSON).
--   HTML 편집 페이지가 이 값을 렌더/편집/저장하고, PDF 는 브라우저 인쇄로 뽑는다.
alter table public.resume_drafts
  add column if not exists resume_content jsonb;

comment on column public.resume_drafts.resume_content is
  'AI 정리+관리자 편집을 거친 최종 이력서(구조화 JSON). null이면 아직 생성 전.';
