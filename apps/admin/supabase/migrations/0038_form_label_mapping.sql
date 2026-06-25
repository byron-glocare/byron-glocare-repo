-- =============================================================================
-- 0038: 작성서류 docx 라벨 매핑 (study_admission_form_files.label_mapping)
--
-- docx 토큰 채움 양식에서, 감지된 표 라벨 → 표준데이터 key 매핑을 양식별로 저장.
--   - 관리자가 양식 상세에서 "감지된 칸 → 표준데이터 드롭다운"으로 확정.
--   - center 생성 시 이 매핑을 우선 사용(없는 라벨은 카탈로그 자동매칭 폴백).
--   - 형태: { "정규화라벨": "std_key", ... }  (값 "" = 채우지 않음)
-- PDF 좌표 양식(field_overlays)과 무관 — docx 전용.
-- =============================================================================

alter table public.study_admission_form_files
  add column if not exists label_mapping jsonb not null default '{}'::jsonb;
