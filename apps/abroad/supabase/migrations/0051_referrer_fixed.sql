-- 0051: 추천인 = 글로케어 (고정값)
--
-- 추천인은 학생·유학센터가 입력할 항목이 아니라 언제나 글로케어다.
-- 기존 'agency_name'(추천인 (에이전시 회사명)) 을 그대로 쓴다 —
-- 활성 상태이고 입력값이 0건이라 새 키를 만들 이유가 없다.
--
-- 값 자체는 애플리케이션이 항상 '글로케어'로 맞춘다(lib/fixed-values.ts).
-- 정보입력 화면에서는 입력칸이 아니라 "자동 입력 항목" 안내로만 보인다.
--
-- 멱등: 라벨·힌트만 갱신하므로 여러 번 실행해도 안전하다.

update study_student_data_types set
  label_ko   = '추천인',
  label_vi   = 'Người giới thiệu',
  hint_ko    = '항상 글로케어로 들어갑니다. 입력하실 필요 없습니다.',
  hint_vi    = 'Luôn được điền là GLOCARE. Bạn không cần nhập.',
  is_active  = true,
  updated_at = now()
where key = 'agency_name';

-- 이미 다른 값이 들어간 학생이 있으면 글로케어로 정정
-- (현재 입력값 0건이라 대상 없음 — 재실행 대비)
update study_student_data_values
   set value = '"글로케어"'::jsonb, updated_at = now()
 where data_type_key = 'agency_name'
   and value is distinct from '"글로케어"'::jsonb;

-- 확인용
-- select key, label_ko, hint_ko, is_active from study_student_data_types where key = 'agency_name';
-- select count(*) from study_student_data_values where data_type_key = 'agency_name';
