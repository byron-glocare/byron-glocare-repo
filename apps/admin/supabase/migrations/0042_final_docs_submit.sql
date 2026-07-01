-- =============================================================================
-- 0042: 최종 서류 플로우 변경 — 자동생성 '확정' → 사람이 수정본 업로드 후 '최종 제출'
--
-- 배경: 기존엔 [확정하기]가 AI가 자동으로 채운 파일을 그대로 저장해 어드민에
-- 노출했다. 그러나 자동 채움본은 초안일 뿐이라 서명·수기 보정이 빠져 있다.
-- → 새 플로우:
--    1) [초안 생성·다운로드] : 기본정보 채운 파일 다운로드(서버 저장 안 함)
--    2) 사람이 서명·보정 후  [수정본 업로드] : 편집한 최종 파일을 스토리지에 저장
--       (이때 study_student_final_docs row = 업로드한 수정본. finalized_at=업로드시각)
--    3) [최종 제출하기]       : submitted_at 세팅 → 이때부터 어드민(글로케어)이 열람
--
-- study_student_final_docs 재사용. file_path/file_name/size_bytes = 업로드한 수정본.
-- finalized_at/finalized_by = 수정본 업로드 시각/사람.  (컬럼 추가만, 파괴 없음)
--
-- ※ 기존 행(자동생성 확정본)은 submitted_at 이 NULL 이라 어드민에서 자동으로
--   숨겨진다(재검증 필요). 데이터는 삭제하지 않는다.
-- =============================================================================

alter table public.study_student_final_docs
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

comment on column public.study_student_final_docs.submitted_at is
  '최종 제출 시각. NULL=수정본만 업로드됨(준비중), NOT NULL=최종 제출→어드민 노출';
comment on column public.study_student_final_docs.finalized_at is
  '(0042 이후) 수정본 업로드 시각. 자동생성 확정 개념은 폐기.';

create index if not exists idx_final_docs_submitted
  on public.study_student_final_docs(submitted_at);
