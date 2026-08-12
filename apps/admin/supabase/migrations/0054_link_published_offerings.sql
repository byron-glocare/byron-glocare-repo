-- 0054: 노출 중인데 모집요강이 연결 안 된 모집(offering) 복구
--
-- 유학센터의 "지원 가능한 대학" 목록은 study_offerings 에서
--   status = 'published' AND source_spec_id IS NOT NULL
-- 인 것만 뽑는다. 그런데 노출 게이트가 "이 대학·학기에 승인된 모집요강이 있는가"만
-- 보고, "이 모집 행에 그 요강이 걸려 있는가"는 안 봤다. 그래서 연결이 빈 채로
-- 노출된 모집이 생겼고, 그건 센터 화면에서 보이지 않는다.
--
-- 보이는 모집이 0건이 되면 센터 화면이 "모집요강 직접 선택"으로 자동 폴백해서
-- 승인된 모집요강 전부(= 모집에 넣지 않은 대학까지)를 지원 가능한 것처럼 보여줬다.
-- 그게 이번에 신고된 증상이다.
--
-- 코드는 고쳤다 — 노출 시 게이트가 찾은 승인 요강을 자동으로 건다.
-- 이 마이그레이션은 이미 그 상태로 남아 있는 행을 메운다.
--
-- 안전장치: 같은 (대학, 학기)에 승인된 모집요강이 **정확히 하나**일 때만 연결한다.
-- 여럿이면 어느 것인지 사람이 골라야 하므로 건드리지 않는다.
-- 멱등: 이미 연결된 행은 대상에서 빠진다.

update public.study_offerings o
   set source_spec_id = s.id,
       updated_at = now()
  from public.study_admission_specs s
 where o.status = 'published'
   and o.source_spec_id is null
   and s.university_id = o.university_id
   and s.term = o.term
   and s.status = 'approved'
   and (
     select count(*)
       from public.study_admission_specs s2
      where s2.university_id = o.university_id
        and s2.term = o.term
        and s2.status = 'approved'
   ) = 1;

-- 확인용 — 0건이어야 정상
-- select o.id, u.name_ko, o.term
--   from public.study_offerings o
--   join public.universities u on u.id = o.university_id
--  where o.status = 'published' and o.source_spec_id is null;
