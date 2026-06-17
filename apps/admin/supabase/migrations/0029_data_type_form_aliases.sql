-- 0029: 표준데이터 별칭(aliases) 보강 — 한국 대학 입학원서 양식 라벨 흡수
--
-- 자동 배치/매칭이 PDF 양식의 라벨("성명","영문","생년월일" 등)을 학생 데이터 항목으로
-- 연결하도록, 각 data_type 에 양식에서 자주 쓰는 표기를 alias 로 추가한다.
-- (picker 매칭은 공백·구두점 무시 + 부분일치라 띄어쓰기 변형은 자동 흡수)
--
-- 멱등: 기존 aliases 와 합집합(중복 제거). 운영자: Supabase SQL 에디터에 붙여넣어 실행.

with m(key, al) as (
  values
    -- 신원
    ('full_name_ko',  ARRAY['한글','한글성명','한글이름','성명한글','한국어이름','한글명']),
    ('full_name_en',  ARRAY['영문','영문성명','영문이름','성명영문','로마자','로마자성명','영문명','name','englishname']),
    ('full_name_vi',  ARRAY['베트남이름','현지이름','현지명']),
    ('full_name_hanja', ARRAY['한자','한자성명','한자이름','한자명']),
    ('birth_date',    ARRAY['생년월일','생일','출생일','생년월','dateofbirth','dob']),
    ('gender',        ARRAY['성별','sex','gender']),
    ('nationality',   ARRAY['국적','nationality']),
    ('passport_no',   ARRAY['여권번호','여권','passport','passportno','passportnumber']),
    ('passport_expiry', ARRAY['여권만료일','여권유효기간','여권만기일','여권만기']),
    ('passport_issued', ARRAY['여권발급일']),
    ('foreign_registration_no', ARRAY['외국인등록번호','외국인등록','등록번호']),
    ('alien_registration_no', ARRAY['외국인등록번호','외국인등록','예비등록번호']),
    ('visa_expiry_date', ARRAY['비자만기일','비자만료일','비자유효기간','체류만료일']),
    ('first_entry_korea_date', ARRAY['최초입국일','입국일','대한민국입국일']),
    ('residence_addr_vn', ARRAY['베트남거주주소','베트남주소']),
    -- 연락처
    ('student_phone', ARRAY['전화번호','휴대폰','핸드폰','연락처','전화','phone','tel','한국연락처1','한국연락처']),
    ('student_email', ARRAY['이메일','email','메일','전자우편','emailaddress','이메일주소']),
    ('korea_address', ARRAY['한국주소','국내주소','한국거주지']),
    ('home_country_address', ARRAY['본국주소','자국주소','본국거주지']),
    ('home_country_phone_primary', ARRAY['본국연락처1','본국연락처','본국전화']),
    ('home_country_phone_secondary', ARRAY['본국연락처2']),
    ('korea_phone_secondary', ARRAY['한국연락처2']),
    -- 학력
    ('highschool_name', ARRAY['고등학교','고교','출신고교','고교명','졸업고등학교','출신학교','highschool','고등학교명']),
    ('highschool_location', ARRAY['소재지','소재국명','학교소재지','고등학교소재지']),
    ('highschool_grad_date', ARRAY['졸업일','졸업년월일','졸업일자','고등학교졸업일','졸업년월']),
    ('highschool_period', ARRAY['재학기간','고등학교재학기간']),
    ('highschool_gpa', ARRAY['성적','gpa','평점','내신']),
    ('middle_school_name', ARRAY['중학교','중학교명']),
    ('middle_school_period', ARRAY['중학교재학기간']),
    ('elementary_school_name', ARRAY['초등학교','초등학교명']),
    ('elementary_school_period', ARRAY['초등학교재학기간']),
    -- 가족
    ('guardian_name', ARRAY['보호자','보호자성명','보호자이름']),
    ('guardian_relation', ARRAY['보호자관계'])
)
update public.study_student_data_types t
set aliases = (
  select array(
    select distinct e
    from unnest(coalesce(t.aliases, '{}'::text[]) || m.al) as e
    where e is not null and e <> ''
  )
)
from m
where t.key = m.key;
