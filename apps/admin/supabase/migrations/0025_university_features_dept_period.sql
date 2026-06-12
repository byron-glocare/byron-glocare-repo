-- 0030: 대학교 '특징/강점' 체크 4종 + 학과 '과정(수학기간)'
--
--   적용: Supabase SQL 에디터에 붙여넣어 실행 (이 프로젝트 표준 워크플로).
--   안전: 컬럼 추가만 — 기존 데이터/노출 영향 없음. 기본값 false / NULL.
--
--   배경:
--     · 대학교 상세 '홈페이지 노출 정보'의 특징/강점을 자유텍스트(strengths)에서
--       4개 고정 체크로 전환. strengths 텍스트 컬럼은 보존(내부 메모).
--     · '기숙사'는 기존 dormitory 불리언과 별개로 홈페이지 강점 표시용 feature_dormitory 신설
--       (운영자 결정: 새 boolean 4컬럼).
--     · 학과 표의 '과정' 컬럼 = 수학기간(예: '2년', '4년', '1년 6개월').

-- 대학교 특징/강점 (홈페이지 노출용)
alter table public.universities
  add column if not exists feature_transport boolean not null default false,  -- 편리한 교통
  add column if not exists feature_parttime  boolean not null default false,  -- 많은 알바 자리
  add column if not exists feature_housing   boolean not null default false,  -- 많은 숙소
  add column if not exists feature_dormitory boolean not null default false;  -- 기숙사

comment on column public.universities.feature_transport is '홈페이지 강점: 편리한 교통';
comment on column public.universities.feature_parttime  is '홈페이지 강점: 많은 알바 자리';
comment on column public.universities.feature_housing   is '홈페이지 강점: 많은 숙소';
comment on column public.universities.feature_dormitory is '홈페이지 강점: 기숙사';

-- 학과 과정(수학기간)
alter table public.departments
  add column if not exists study_period text;  -- 예: '2년', '4년', '1년 6개월'

comment on column public.departments.study_period is '학과 과정 = 수학기간(자유 텍스트)';
