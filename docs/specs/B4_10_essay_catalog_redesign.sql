-- =============================================================
-- B4-10 essay 카탈로그 재설계 — 학생 친화 sub-question 단위
--
-- 동기: 양식의 원 서술형 질문 ("자기 소개(취미, 특기, 인생관, 성장과정, 가족환경 등)")
-- 을 그대로 학생에게 노출하면 답하기 어려움. 친근한 sub-question 단위로 카탈로그를
-- 잘게 쪼개서, 학생이 편안하게 답할 수 있게 한다.
-- AI 가 양식 분석 시 sub-topic 들을 카탈로그 키와 매핑하고, 작문 시 학생의 친근한 답변을
-- 양식 원 질문의 격식 톤으로 조합한다.
--
-- 변경:
--   1. essay_self_intro → 4개 sub-key 로 분해 + 기존 key 비활성화
--   2. 기존 essay 키들의 hint 를 친근한 톤으로 업그레이드
--   3. 일부 신규 추가 (취미·특기, 본인 스타일, 성장과정, 가족 소개)
-- =============================================================

-- 1. essay_self_intro 비활성화 (분해됨)
UPDATE study_student_data_types
SET is_active = false,
    hint_ko = '(분해됨 — essay_hobby_talent / essay_personal_style / essay_growing_up / essay_family_background 사용)',
    hint_vi = '(Đã chia nhỏ — dùng các key mới)'
WHERE key = 'essay_self_intro';

-- 2. 새 sub-question 키 INSERT (essay_self_intro 분해)
INSERT INTO study_student_data_types
  (key, label_ko, label_vi, category, input_type, hint_ko, hint_vi, is_essay_basis, is_default_required, sort_order)
VALUES
('essay_hobby_talent', '취미·특기', 'Sở thích và sở trường', 'essay', 'long_text',
 '본인의 취미나 특기에 대해 간단히 알려주세요. 대학 진학과 관련되지 않아도 됩니다. 평소 좋아하는 활동, 잘하는 것, 시간 날 때 하는 일.',
 'Hãy cho biết sở thích hoặc sở trường của bạn. Không cần liên quan đến đại học. Hoạt động yêu thích, điều bạn làm tốt, việc làm lúc rảnh.',
 true, false, 208),

('essay_personal_style', '본인의 스타일·가치관', 'Phong cách và giá trị quan của bạn', 'essay', 'long_text',
 '본인의 성격, 좋아하는 삶의 방식, 중요하게 생각하는 가치를 자유롭게 적어주세요. "나는 이런 사람이다" 라고 친구에게 소개하듯이.',
 'Tính cách, lối sống ưa thích, giá trị quan trọng của bạn. Viết tự do như giới thiệu với bạn bè "Tôi là người như thế này".',
 true, false, 209),

('essay_growing_up', '성장과정', 'Quá trình trưởng thành', 'essay', 'long_text',
 '어린 시절부터 지금까지의 성장 과정을 간단히 알려주세요. 기억나는 큰 경험, 본인에게 영향을 준 사건이나 사람.',
 'Quá trình trưởng thành từ nhỏ đến giờ. Trải nghiệm lớn còn nhớ, sự kiện/người ảnh hưởng đến bạn.',
 true, false, 210),

('essay_family_background', '가족 소개', 'Giới thiệu gia đình', 'essay', 'long_text',
 '가족을 소개해주세요. 가족 구성원, 가족 분위기, 특별한 점이 있다면 꼭 알려주세요. (※ 부모 직업·연락처는 별도 필드)',
 'Hãy giới thiệu gia đình. Thành viên, không khí gia đình, điều đặc biệt nếu có. (Nghề nghiệp/liên hệ cha mẹ ở mục riêng)',
 true, false, 211)
ON CONFLICT (key) DO NOTHING;

-- 3. 기존 essay 키들 hint 친근 톤으로 업그레이드
UPDATE study_student_data_types
SET hint_ko = '한국이 끌리게 된 계기를 자유롭게 적어주세요. K-pop·드라마·음식·여행 등 처음 한국에 관심 갖게 된 계기, 깊어진 이유, 친한 한국인이 있었는지, 직접 가본 적이 있는지 등.',
    hint_vi = 'Lý do bạn bị hấp dẫn bởi Hàn Quốc. K-pop, phim, ẩm thực, du lịch... Lý do ban đầu, lý do quan tâm sâu hơn, có quen người Hàn không, đã từng đi Hàn chưa.'
WHERE key = 'essay_motivation_korea';

UPDATE study_student_data_types
SET hint_ko = '이 학과·전공에 끌리는 이유. 관련된 본인 경험, 좋아하는 과목, 인상 깊었던 사례, 나중에 하고 싶은 일과 어떤 연결이 있는지.',
    hint_vi = 'Lý do bị hấp dẫn bởi ngành này. Kinh nghiệm liên quan, môn học yêu thích, ví dụ ấn tượng, liên kết với việc muốn làm sau này.'
WHERE key = 'essay_major_motivation';

UPDATE study_student_data_types
SET hint_ko = '입학 후 학기별로 무엇을 배우고 싶은지, 어떤 자격증·언어·역량을 키우고 싶은지. 동아리·교내 활동 계획. 너무 거창하지 않게 진솔하게.',
    hint_vi = 'Sau khi nhập học muốn học gì theo từng học kỳ, muốn phát triển chứng chỉ/ngôn ngữ/năng lực gì. Câu lạc bộ, hoạt động trong trường. Chân thành, không cần phô trương.'
WHERE key = 'essay_study_plan_basis';

UPDATE study_student_data_types
SET hint_ko = '졸업 후 어디서(한국·베트남·제3국) 어떤 일을 하고 싶은지. 왜 그 진로인지 본인의 동기. 한국 유학 경험을 어떻게 활용할지.',
    hint_vi = 'Sau tốt nghiệp muốn làm gì ở đâu (Hàn/Việt/khác). Tại sao chọn nghề đó. Sử dụng kinh nghiệm du học Hàn như thế nào.'
WHERE key = 'essay_career_plan';

UPDATE study_student_data_types
SET hint_ko = '한국어 공부 기간·방법·계기. 한국 문화 경험 (영화·음악·음식·여행). 한국인과 교류한 경험. 본인이 느낀 한국의 매력.',
    hint_vi = 'Thời gian/cách/lý do học tiếng Hàn. Trải nghiệm văn hóa Hàn (phim, nhạc, ẩm thực, du lịch). Giao lưu với người Hàn. Sức hấp dẫn của Hàn theo cảm nhận của bạn.'
WHERE key = 'essay_korea_culture_exp';

UPDATE study_student_data_types
SET hint_ko = '본인의 강점 — 구체적인 예시 있으면 더 좋음. 약점 — 어떻게 극복하려고 노력하는지 짧게.',
    hint_vi = 'Ưu điểm — có ví dụ cụ thể càng tốt. Nhược điểm — bạn nỗ lực khắc phục như thế nào (ngắn gọn).'
WHERE key = 'essay_strengths_weakness';

UPDATE study_student_data_types
SET hint_ko = '특별한 경험·성취 — 상장·자격증·봉사·동아리·리더십·도전·실패 극복 등. 본인에게 의미 있었던 한 가지를 자세히.',
    hint_vi = 'Trải nghiệm/thành tích đặc biệt — giải thưởng, chứng chỉ, tình nguyện, câu lạc bộ, lãnh đạo, thử thách, vượt qua thất bại. Một điều có ý nghĩa với bạn, chi tiết.'
WHERE key = 'essay_special_experience';


-- 4. 확인
SELECT key, label_ko, is_active, hint_ko
FROM study_student_data_types
WHERE category = 'essay'
ORDER BY sort_order;
