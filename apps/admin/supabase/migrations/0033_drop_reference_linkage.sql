-- =============================================================================
-- 0033: "연결성(참조/파생)" 기능 제거 — 별칭만 유지
--
-- 운영자 결정(2026-06-18): 연결성(독립/참조)이 너무 복잡. 참조(파생)는
--   사람이 값을 한 번 더 입력하면 되는 것이라 폐기. 표준데이터 속성은 별칭만 남긴다.
--
-- 처리: 파생(is_derived) 항목을 일반 항목으로 중립화한다.
--   (예: guardian_name 이 더는 자동계산되지 않고, 학생/센터가 직접 입력.)
--
-- ⚠️ 컬럼(link_type/is_derived/derived_role/derived_from)은 **드롭하지 않는다.**
--    아직 코드 배포 전이라, 운영(prod) 코드가 이 컬럼을 select 하면 깨지기 때문.
--    → 중립값으로만 고정. 컬럼 물리 삭제는 코드 배포 후 별도 마이그레이션에서.
--
-- ⚠️ 실행 순서: 0031(동일→별칭 병합) 먼저, 그 다음 이 0033.
--    (0033 이 link_type 을 전부 independent 로 바꾸므로, 0031 의 link_type='same'
--     대상이 사라지지 않도록 0031 을 먼저 돌려야 한다.)
-- =============================================================================

begin;

update public.study_student_data_types
  set is_derived  = false,
      derived_from = null,
      derived_role = null,
      link_type    = 'independent'
  where is_derived = true
     or derived_from is not null
     or derived_role is not null
     or link_type <> 'independent';

commit;

-- (코드 배포 후, 한가할 때 실행할 정리 — 지금은 실행하지 말 것)
-- alter table public.study_student_data_types
--   drop constraint if exists study_student_data_types_link_type_chk,
--   drop column if exists link_type,
--   drop column if exists is_derived,
--   drop column if exists derived_role,
--   drop column if exists derived_from;
