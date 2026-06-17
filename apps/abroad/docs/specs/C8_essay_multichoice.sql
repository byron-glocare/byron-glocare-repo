-- =====================================================================
--  C8 — AI 작문 기초자료(essay) 항목을 '다중선택 + 기타' 로 전환
--
--  학생이 긴 글을 쓰는 대신 키워드(보기)를 고르면 AI 가 글로 풀어쓴다.
--  "기타" 는 UI 에서 직접입력(자유 텍스트) → 배열에 그대로 추가됨.
--  (서술이 꼭 필요한 essay_growing_up / personal_style / family_background 는 long_text 유지)
-- =====================================================================

update study_student_data_types set input_type='multi_select', options='[
  {"value":"advanced_medical","label_ko":"한국의 선진 의료·보건","label_vi":"Y tế Hàn Quốc tiên tiến"},
  {"value":"job_opportunity","label_ko":"한국 취업 기회","label_vi":"Cơ hội việc làm tại Hàn"},
  {"value":"hallyu","label_ko":"한국 문화·한류 관심","label_vi":"Yêu thích văn hóa Hàn (Hallyu)"},
  {"value":"recommendation","label_ko":"가족·지인 추천","label_vi":"Người thân giới thiệu"},
  {"value":"learn_korean","label_ko":"한국어를 배우고 싶어서","label_vi":"Muốn học tiếng Hàn"},
  {"value":"scholarship","label_ko":"장학금·학비 조건","label_vi":"Học bổng·học phí"},
  {"value":"career_after","label_ko":"졸업 후 진로(E-7 등)","label_vi":"Định hướng sau tốt nghiệp"}
]'::jsonb where key='essay_motivation_korea';

update study_student_data_types set input_type='multi_select', options='[
  {"value":"aptitude","label_ko":"적성·흥미에 맞아서","label_vi":"Phù hợp sở thích·năng khiếu"},
  {"value":"job_prospect","label_ko":"취업 전망이 좋아서","label_vi":"Triển vọng việc làm tốt"},
  {"value":"aging_society","label_ko":"고령화 사회에 필요한 분야","label_vi":"Cần cho xã hội già hóa"},
  {"value":"family_job","label_ko":"가족이 관련 직업","label_vi":"Gia đình làm nghề liên quan"},
  {"value":"contribute","label_ko":"사회에 기여하고 싶어서","label_vi":"Muốn đóng góp xã hội"},
  {"value":"stable_job","label_ko":"안정적인 직업","label_vi":"Nghề ổn định"}
]'::jsonb where key='essay_major_motivation';

update study_student_data_types set input_type='multi_select', options='[
  {"value":"work_korea","label_ko":"한국에서 취업","label_vi":"Làm việc tại Hàn"},
  {"value":"work_korean_company_vn","label_ko":"베트남 내 한국기업 취업","label_vi":"Cty Hàn tại VN"},
  {"value":"startup","label_ko":"관련 분야 창업","label_vi":"Khởi nghiệp"},
  {"value":"further_study","label_ko":"상위 학위(편입·대학원)","label_vi":"Học lên cao"},
  {"value":"certification","label_ko":"전문 자격증 취득","label_vi":"Lấy chứng chỉ chuyên môn"}
]'::jsonb where key='essay_career_plan';

update study_student_data_types set input_type='multi_select', options='[
  {"value":"reading","label_ko":"독서","label_vi":"Đọc sách"},
  {"value":"sports","label_ko":"운동","label_vi":"Thể thao"},
  {"value":"music","label_ko":"음악","label_vi":"Âm nhạc"},
  {"value":"cooking","label_ko":"요리","label_vi":"Nấu ăn"},
  {"value":"travel","label_ko":"여행","label_vi":"Du lịch"},
  {"value":"art","label_ko":"그림·미술","label_vi":"Hội họa"},
  {"value":"photo","label_ko":"사진","label_vi":"Nhiếp ảnh"},
  {"value":"volunteer","label_ko":"봉사활동","label_vi":"Tình nguyện"},
  {"value":"language","label_ko":"외국어","label_vi":"Ngoại ngữ"},
  {"value":"game","label_ko":"게임","label_vi":"Trò chơi"}
]'::jsonb where key='essay_hobby_talent';

update study_student_data_types set input_type='multi_select', options='[
  {"value":"diligent","label_ko":"성실함","label_vi":"Chăm chỉ"},
  {"value":"responsible","label_ko":"책임감","label_vi":"Trách nhiệm"},
  {"value":"proactive","label_ko":"적극성","label_vi":"Chủ động"},
  {"value":"cooperative","label_ko":"협동심","label_vi":"Hợp tác"},
  {"value":"patient","label_ko":"인내심","label_vi":"Kiên nhẫn"},
  {"value":"meticulous","label_ko":"꼼꼼함","label_vi":"Tỉ mỉ"},
  {"value":"leadership","label_ko":"리더십","label_vi":"Lãnh đạo"},
  {"value":"sociable","label_ko":"친화력","label_vi":"Hòa đồng"},
  {"value":"positive","label_ko":"긍정적","label_vi":"Tích cực"}
]'::jsonb where key='essay_strengths_weakness';

update study_student_data_types set input_type='multi_select', options='[
  {"value":"drama","label_ko":"한국 드라마·영화","label_vi":"Phim Hàn"},
  {"value":"kpop","label_ko":"K-pop","label_vi":"K-pop"},
  {"value":"food","label_ko":"한국 음식","label_vi":"Ẩm thực Hàn"},
  {"value":"study_korean","label_ko":"한국어 공부","label_vi":"Học tiếng Hàn"},
  {"value":"travel_korea","label_ko":"한국 여행","label_vi":"Du lịch Hàn"},
  {"value":"korean_friend","label_ko":"한국 친구","label_vi":"Bạn người Hàn"},
  {"value":"event","label_ko":"한국 행사 참여","label_vi":"Tham gia sự kiện Hàn"},
  {"value":"none","label_ko":"경험 없음","label_vi":"Chưa có"}
]'::jsonb where key='essay_korea_culture_exp';

update study_student_data_types set input_type='multi_select', options='[
  {"value":"volunteer","label_ko":"봉사활동","label_vi":"Tình nguyện"},
  {"value":"club","label_ko":"동아리·학생회","label_vi":"CLB·hội học sinh"},
  {"value":"award","label_ko":"대회 수상","label_vi":"Đạt giải thưởng"},
  {"value":"work","label_ko":"아르바이트·인턴","label_vi":"Làm thêm·thực tập"},
  {"value":"leader","label_ko":"리더 경험","label_vi":"Vai trò lãnh đạo"},
  {"value":"overseas","label_ko":"해외 경험","label_vi":"Kinh nghiệm nước ngoài"},
  {"value":"cert","label_ko":"자격증 취득","label_vi":"Lấy chứng chỉ"}
]'::jsonb where key='essay_special_experience';

update study_student_data_types set input_type='multi_select', options='[
  {"value":"korean_up","label_ko":"한국어 실력 향상","label_vi":"Nâng cao tiếng Hàn"},
  {"value":"major_knowledge","label_ko":"전공 지식 습득","label_vi":"Kiến thức chuyên ngành"},
  {"value":"cert","label_ko":"자격증 취득","label_vi":"Lấy chứng chỉ"},
  {"value":"good_grade","label_ko":"좋은 학점","label_vi":"Điểm số tốt"},
  {"value":"intern","label_ko":"인턴·실습","label_vi":"Thực tập"},
  {"value":"club","label_ko":"동아리 활동","label_vi":"Hoạt động CLB"}
]'::jsonb where key='essay_study_plan_basis';
