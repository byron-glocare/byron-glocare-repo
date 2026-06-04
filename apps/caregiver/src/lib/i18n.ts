/**
 * 한/베 dictionary 기반 i18n.
 * cookie 'locale' 로 결정. 기본은 vi (베트남어).
 */
import { cookies } from "next/headers";

export type Locale = "ko" | "vi";
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALES: Locale[] = ["ko", "vi"];

const koDict = {
  // Brand
  "brand.tagline": "외국인 요양보호사와 끝까지 함께 합니다",

  // Nav tabs
  "nav.home": "홈",
  "nav.about": "글로케어 소개",
  "nav.videos": "동영상 교육",
  "nav.cbt": "CBT 문제풀이",
  "nav.partners": "파트너스",
  "nav.ambassador": "엠버서더",
  "nav.resume": "이력서 만들기",
  "nav.profile": "내 정보",
  "nav.login": "로그인",

  // Common
  "common.loading": "불러오는 중...",
  "common.error": "오류가 발생했습니다.",
  "common.save": "저장",
  "common.cancel": "취소",
  "common.submit": "제출",
  "common.close": "닫기",
  "common.required": "필수",
  "common.optional": "선택",

  // Home
  "home.heading": "외국인 요양보호사 자격 취득 지원 서비스",
  "home.tagline": "거주지 인근 교육원 연계 · 베트남어 자료 · 취업 + 비자까지",
  "home.cta.training": "요양보호사 교육 신청",
  "home.cta.partner": "글로케어 제휴 문의",

  // KPI
  "kpi.students": "전체 교육생",
  "kpi.working": "현직 근무자",
  "kpi.training_centers": "제휴 교육원",
  "kpi.care_homes": "제휴 요양원",
  "kpi.universities": "제휴 대학교",

  // USP (4 강점)
  "usp.local.title": "거주지 인근 교육원 연계",
  "usp.local.desc": "전국 협력 교육원 중 가까운 곳을 매칭",
  "usp.material.title": "베트남어 보충자료",
  "usp.material.desc": "주요 개념·의학용어 베트남어 풀이 제공",
  "usp.job.title": "맞춤형 취업 지원",
  "usp.job.desc": "지역·근무시간 고려한 요양원 매칭",
  "usp.visa.title": "전담 행정사 비자 처리",
  "usp.visa.desc": "쉽고 빠른 비자 변경·연장 업무",

  // Feature cards
  "feature.about.title": "글로케어 소개",
  "feature.about.desc": "회사 역할과 비전",
  "feature.videos.title": "동영상 교육",
  "feature.videos.desc": "베트남어 보충 자료 영상",
  "feature.cbt.title": "CBT 문제풀이",
  "feature.cbt.desc": "1,688 문제 · 챕터별 학습",
  "feature.partners.title": "파트너스",
  "feature.partners.desc": "제휴 요양원·교육원·대학",
  "feature.ambassador.title": "엠버서더",
  "feature.ambassador.desc": "혜택과 카톡방 입장 코드",
  "feature.resume.title": "이력서 만들기",
  "feature.resume.desc": "AI 가 양식에 맞춰 PDF 생성",

  // About page
  "about.eyebrow": "글로케어 소개",
  "about.headline": "외국인 요양보호사와\n끝까지 함께 합니다",
  "about.intro":
    "글로케어는 외국인 요양보호사 자격 취득부터 취업, 비자 연장까지 단계별로 안내합니다.",
  "about.audience.title": "이런 분들을 위한 서비스입니다",
  "about.audience.marriage.title": "결혼이민자",
  "about.audience.marriage.desc":
    "시부모님이 치매나 거동이 불편한 장기요양 등급자이신가요? 매달 최대 100여만원까지 정부 지원을 받으면서 안정적인 일자리를 공급 받을 수 있는 요양보호사를 소개합니다.",
  "about.audience.student.title": "유학생",
  "about.audience.student.desc":
    "이제 한국 생활이 재미있어지고 아르바이트도 할만한데 계속 거주할 수 있는 E-7(취업) 비자로 변경이 어려우시죠? 안정적인 한국 거주와 일자리도 쉽게 찾을 수 있는 요양보호사를 소개합니다.",
  "about.ceo.eyebrow": "CEO 인사말",
  "about.ceo.title": "CEO 인사말",
  "about.ceo.body":
    "안녕하세요 글로케어 대표 홍강식입니다.\n\n고령화 저출산으로 점점 늘어나는 요양서비스 수요와 갈수록 심화되어가는 요양보호사의 공급 부족을 해결하기 위해 외국인 요양보호사 양성이 보다 절실해 지고 있습니다.\n\n외국인 요양보호사 양성 정책에 적극적으로 대응하여 보다 많은 글로벌 인재들이 한국에서 성장할 수 있도록 최선을 다하겠습니다.",
  "about.ceo.signature": "글로케어 대표 홍강식 · HONG KANG SIK · CEO",

  // Modals — training signup
  "modal.training.title": "요양보호사 교육 신청",
  "modal.training.subtitle":
    "기본 정보를 입력해주세요. 담당자가 곧 연락드립니다.",
  "modal.training.name": "이름",
  "modal.training.namePh": "홍길동 / NGUYEN VAN A",
  "modal.training.phone": "전화번호",
  "modal.training.phonePh": "010-xxxx-xxxx",
  "modal.training.email": "이메일 (선택)",
  "modal.training.emailPh": "name@example.com",
  "modal.training.region": "거주 지역",
  "modal.training.regionPh": "서울 / 경기 / 부산 ...",
  "modal.training.topik": "TOPIK 등급",
  "modal.training.topikPh": "선택해주세요",
  "modal.training.visa": "비자 종류",
  "modal.training.visaPh": "선택해주세요",
  "modal.training.message": "메모 (선택)",
  "modal.training.messagePh": "추가 문의 사항",
  "modal.training.submit": "신청하기",
  "modal.training.success": "신청이 접수되었습니다.",
  "modal.training.needLogin":
    "교육 신청 전 SNS 로그인이 필요합니다. 로그인 페이지로 이동합니다.",

  // Modals — partnership
  "modal.partnership.title": "글로케어 제휴 문의",
  "modal.partnership.subtitle":
    "교육원·요양원·기업 등 협력 제안을 환영합니다.",
  "modal.partnership.name": "담당자",
  "modal.partnership.company": "회사/기관명",
  "modal.partnership.companyPh": "회사명",
  "modal.partnership.phone": "연락처 (선택)",
  "modal.partnership.email": "이메일",
  "modal.partnership.emailPh": "name@company.com",
  "modal.partnership.message": "제안 내용",
  "modal.partnership.messagePh": "협력하고 싶은 분야를 알려주세요",
  "modal.partnership.submit": "보내기",
  "modal.partnership.success": "제휴 문의가 접수되었습니다.",

  // Ambassador
  "ambassador.eyebrow": "엠버서더",
  "ambassador.title": "엠버서더 혜택",
  "ambassador.intro":
    "글로케어 엠버서더로 활동하시면 카카오톡방에서 다른 교육생들과 정보를 공유하고, 먼저 자격증을 취득한 선배들의 도움을 받을 수 있습니다.",
  "ambassador.code.label": "카톡방 입장 코드",
  "ambassador.code.empty": "(미설정 — 관리자에게 문의)",
  "ambassador.qr.label": "카톡방 QR",
  "ambassador.qr.empty": "(QR 준비 중)",
  "ambassador.benefits.title": "주요 혜택",

  // Partners
  "partners.eyebrow": "파트너스",
  "partners.title": "글로케어 파트너",
  "partners.intro":
    "교육생을 위한 협력 요양원·교육원·대학 정보입니다. 자세한 상담은 글로케어로 문의해주세요.",
  "partners.tab.training_centers": "교육원",
  "partners.tab.care_homes": "요양원",
  "partners.tab.universities": "대학",
  "partners.empty": "등록된 정보가 없습니다.",

  // Terms / Privacy
  "terms.title": "이용약관",
  "privacy.title": "개인정보 처리방침",
  "legal.last_updated": "최종 수정일",

  // Resume
  "resume.eyebrow": "이력서 만들기",
  "resume.title": "AI 가 정리해주는 요양보호사 이력서",
  "resume.intro":
    "기본 정보와 경험을 자유롭게 적으면 AI 가 정리하여 PDF 이력서를 만들어드립니다.",
  "resume.list.title": "내 이력서",
  "resume.list.empty": "아직 만든 이력서가 없습니다.",
  "resume.list.new": "+ 새 이력서 만들기",
  "resume.list.status.draft": "작성 중",
  "resume.list.status.generating": "생성 중...",
  "resume.list.status.ready": "완성",
  "resume.list.status.failed": "실패",
  "resume.locked.title": "멤버십 전용",
  "resume.locked.desc":
    "이력서 만들기는 '웰컴팩' 또는 '교육+웰컴팩' 회원에게만 제공됩니다.",
  "resume.locked.cta": "교육 신청하기",

  // Resume form
  "resume.form.section.basic": "기본 정보",
  "resume.form.section.profile": "추가 정보",
  "resume.form.section.education": "학력",
  "resume.form.section.experience": "경력 (선택)",
  "resume.form.section.certs": "자격증 / 수상 (선택)",
  "resume.form.section.skills": "기술 / 어학",
  "resume.form.section.activities": "기타 활동 (선택)",
  "resume.form.section.intro": "자기소개",
  "resume.form.agree": "개인정보 수집 및 이용에 동의합니다 *",
  "resume.form.name_vi": "이름 (베트남어) *",
  "resume.form.name_vi_ph": "NGUYEN VAN A",
  "resume.form.name_ko": "이름 (한글) *",
  "resume.form.name_ko_ph": "응우옌 반 안",
  "resume.form.birth": "생년월일",
  "resume.form.phone": "한국 전화번호 *",
  "resume.form.phone_ph": "010-1234-5678",
  "resume.form.email": "이메일 *",
  "resume.form.email_ph": "name@example.com",
  "resume.form.address": "한국 내 주소",
  "resume.form.address_ph": "서울시 광진구 능동로 120, 창의관 202호",
  "resume.form.photo": "이력서 사진 (선택)",
  "resume.form.photo_hint": "정면 얼굴 사진 권장 (JPG/PNG)",
  "resume.form.motto": "어떤 요양보호사가 되고 싶은가요?",
  "resume.form.motto_ph":
    "예) 어르신의 불편함을 먼저 찾아내는 꼼꼼한 요양보호사",
  "resume.form.education_ph":
    "예) 한국대학교 / 경영학과 / 2023년 졸업\n예) 한국대학교 대학원 / 경제학과 석사 / 2025년 졸업(예정)",
  "resume.form.experience_ph":
    "근무지 / 기간 / 담당 / 업무상세\n예) 글로케어 / 24년 5월 - 25년 10월 / 홍보담당 / 틱톡 영상제작, 베트남어 번역",
  "resume.form.certs_ph":
    "이름 / 발급기관 / 취득일\n예) 요양보호사 자격증 / 한국보건의료인국가시험원 / 25년 8월\n예) TOPIK 4급 / 국제국립교육원 / 25년 8월",
  "resume.form.skills_ph":
    "명칭 / 수준\n예) 한국어 / 일상대화 가능\n예) 베트남어 / 모국어\n예) 문서작성 (워드, 엑셀) / 중간",
  "resume.form.activities_ph":
    "활동명 / 기간 / 기관 / 상세\n예) 요양원 봉사활동 / 25년 1월 ~ 26년 3월 / 한국 요양원 / 매주 일요일, 어르신 식사 보조",
  "resume.form.episode": "교육·실습 에피소드",
  "resume.form.episode_ph":
    "요양보호사가 되고 싶다고 느낀 구체적인 사례나 경험을 자유롭게 작성해주세요. AI 가 자기소개로 다듬어 드립니다.",
  "resume.form.submit": "이력서 만들기",
  "resume.form.submitting": "AI 가 작성 중... (10-30초)",

  // Resume view
  "resume.view.download": "PDF 다운로드",
  "resume.view.delete": "삭제",
  "resume.view.delete_confirm": "이 이력서를 삭제하시겠습니까?",
  "resume.view.failed":
    "이력서 생성에 실패했습니다. 다시 만들어 주세요.",
  "resume.view.generating":
    "AI 가 이력서를 작성 중입니다. 잠시 후 새로고침 해주세요.",

  // Videos
  "videos.eyebrow": "동영상 교육",
  "videos.title": "베트남어 보충 자료 영상",
  "videos.intro":
    "주요 개념과 의학용어를 베트남어로 설명한 보충 영상입니다. 시청 여부가 자동 저장됩니다.",
  "videos.tag.all": "전체",
  "videos.watched": "시청 완료",
  "videos.unwatched": "미시청",
  "videos.empty": "등록된 영상이 없습니다.",
  "videos.locked.title": "멤버십 전용",
  "videos.locked.desc":
    "동영상 교육은 '교육' 또는 '교육+웰컴팩' 회원에게만 제공됩니다.",
  "videos.player.back": "← 목록으로",
  "videos.player.mark_watched": "시청 완료 표시",
  "videos.player.unmark_watched": "시청 표시 해제",

  // CBT
  "cbt.eyebrow": "CBT 문제풀이",
  "cbt.title": "요양보호사 자격 시험 대비",
  "cbt.intro":
    "전체 1,688 문제 중 30 문제를 무작위로 출제합니다. 챕터를 선택하거나 전체에서 풀 수 있습니다.",
  "cbt.chapter.all": "전체",
  "cbt.chapter.label": "챕터",
  "cbt.chapter.mock": "그림 중심 실전모의고사",
  "cbt.start": "시작하기",
  "cbt.recent": "최근 응시",
  "cbt.score": "점수",
  "cbt.no_attempts": "아직 응시 내역이 없습니다.",
  "cbt.locked.title": "멤버십 전용",
  "cbt.locked.desc":
    "CBT 문제풀이는 '교육' 또는 '교육+웰컴팩' 회원에게만 제공됩니다.",
  "cbt.locked.cta": "교육 신청하기",
  "cbt.quiz.q": "문항",
  "cbt.quiz.of": "/",
  "cbt.quiz.unanswered": "미응답",
  "cbt.quiz.submit": "결과 보기",
  "cbt.quiz.confirm_unanswered":
    "응답하지 않은 문제가 있습니다. 그래도 제출하시겠습니까?",
  "cbt.quiz.previous": "이전",
  "cbt.quiz.next": "다음",
  "cbt.result.title": "응시 결과",
  "cbt.result.correct": "정답",
  "cbt.result.your_answer": "내 답",
  "cbt.result.intent": "문제 의도",
  "cbt.result.explanation": "보기 해설",
  "cbt.result.terms": "핵심 용어",
  "cbt.result.retry": "다시 풀기",

  // Login
  "login.title": "로그인",
  "login.desc": "SNS 계정으로 간편 로그인",
  "login.google": "Google 로 시작하기",
  "login.facebook": "Facebook 으로 시작하기",

  // Footer
  "footer.privacy": "개인정보처리방침",
  "footer.terms": "이용약관",
  "footer.copyright": "© 2026 글로케어(GloCare). All rights reserved.",
};

type DictShape = { readonly [K in keyof typeof koDict]: string };

const viDict: DictShape = {
  "brand.tagline": "Đồng hành cùng điều dưỡng viên người nước ngoài đến cùng",

  "nav.home": "Trang chủ",
  "nav.about": "Giới thiệu GLOCARE",
  "nav.videos": "Video đào tạo",
  "nav.cbt": "Luyện thi CBT",
  "nav.partners": "Đối tác",
  "nav.ambassador": "Đại sứ",
  "nav.resume": "Tạo CV",
  "nav.profile": "Thông tin của tôi",
  "nav.login": "Đăng nhập",

  "common.loading": "Đang tải...",
  "common.error": "Đã xảy ra lỗi.",
  "common.save": "Lưu",
  "common.cancel": "Hủy",
  "common.submit": "Gửi",
  "common.close": "Đóng",
  "common.required": "Bắt buộc",
  "common.optional": "Tùy chọn",

  "home.heading": "Dịch vụ hỗ trợ lấy chứng chỉ Điều dưỡng viên cho người nước ngoài",
  "home.tagline":
    "Kết nối trung tâm đào tạo gần nơi cư trú · Tài liệu tiếng Việt · Hỗ trợ việc làm + visa",
  "home.cta.training": "Đăng ký khóa đào tạo",
  "home.cta.partner": "Liên hệ hợp tác",

  "kpi.students": "Tổng học viên",
  "kpi.working": "Đang làm việc",
  "kpi.training_centers": "Trung tâm đào tạo",
  "kpi.care_homes": "Viện dưỡng lão hợp tác",
  "kpi.universities": "Đại học hợp tác",

  "usp.local.title": "Trung tâm đào tạo gần bạn",
  "usp.local.desc": "Ghép nối trung tâm gần nơi cư trú trong mạng lưới toàn quốc",
  "usp.material.title": "Tài liệu tiếng Việt",
  "usp.material.desc": "Giải thích thuật ngữ y học và khái niệm chính bằng tiếng Việt",
  "usp.job.title": "Hỗ trợ việc làm cá nhân hóa",
  "usp.job.desc": "Ghép nối viện dưỡng lão theo khu vực và giờ làm việc",
  "usp.visa.title": "Xử lý visa qua chuyên viên",
  "usp.visa.desc": "Đổi và gia hạn visa nhanh chóng, thuận tiện",

  "feature.about.title": "Giới thiệu GLOCARE",
  "feature.about.desc": "Vai trò và tầm nhìn của công ty",
  "feature.videos.title": "Video đào tạo",
  "feature.videos.desc": "Video tài liệu bổ sung tiếng Việt",
  "feature.cbt.title": "Luyện thi CBT",
  "feature.cbt.desc": "1.688 câu hỏi · Học theo chương",
  "feature.partners.title": "Đối tác",
  "feature.partners.desc": "Viện dưỡng lão · Trung tâm · Đại học",
  "feature.ambassador.title": "Đại sứ",
  "feature.ambassador.desc": "Quyền lợi và mã vào nhóm KakaoTalk",
  "feature.resume.title": "Tạo CV",
  "feature.resume.desc": "AI tạo CV theo mẫu chuẩn dạng PDF",

  "about.eyebrow": "Giới thiệu GLOCARE",
  "about.headline":
    "Đồng hành cùng điều dưỡng viên\nngười nước ngoài đến cùng",
  "about.intro":
    "GLOCARE hướng dẫn từng bước — từ chứng chỉ điều dưỡng viên đến việc làm và gia hạn visa cho người nước ngoài.",
  "about.audience.title": "Dịch vụ dành cho",
  "about.audience.marriage.title": "Phụ nữ kết hôn nhập cư",
  "about.audience.marriage.desc":
    "Bố mẹ chồng bị Alzheimer hoặc vận động khó khăn, được xếp hạng chăm sóc dài hạn? Chúng tôi giới thiệu nghề điều dưỡng viên với hỗ trợ chính phủ tới hơn 1 triệu won mỗi tháng.",
  "about.audience.student.title": "Du học sinh",
  "about.audience.student.desc":
    "Cuộc sống Hàn Quốc đang thú vị nhưng khó đổi sang visa E-7 để ở lại lâu dài? Chúng tôi giới thiệu công việc điều dưỡng viên giúp bạn ở lại và làm việc ổn định.",
  "about.ceo.eyebrow": "Lời chào của CEO",
  "about.ceo.title": "Lời chào của CEO",
  "about.ceo.body":
    "Xin chào, tôi là Hong Kang Sik, Giám đốc GLOCARE.\n\nNhu cầu chăm sóc tăng dần do già hóa và mức sinh thấp, trong khi nguồn cung điều dưỡng viên ngày càng thiếu hụt — việc đào tạo điều dưỡng viên người nước ngoài trở nên cấp thiết hơn bao giờ hết.\n\nGLOCARE sẽ chủ động ứng phó với chính sách đào tạo điều dưỡng viên người nước ngoài, để nhiều nhân tài toàn cầu có thể phát triển tại Hàn Quốc.",
  "about.ceo.signature": "Đại diện GLOCARE · HONG KANG SIK · CEO",

  "modal.training.title": "Đăng ký khóa đào tạo điều dưỡng viên",
  "modal.training.subtitle":
    "Vui lòng nhập thông tin cơ bản. Nhân viên sẽ liên hệ với bạn.",
  "modal.training.name": "Họ tên",
  "modal.training.namePh": "NGUYEN VAN A / 응우옌 반 안",
  "modal.training.phone": "Số điện thoại",
  "modal.training.phonePh": "010-xxxx-xxxx",
  "modal.training.email": "Email (tùy chọn)",
  "modal.training.emailPh": "name@example.com",
  "modal.training.region": "Khu vực cư trú",
  "modal.training.regionPh": "Seoul / Gyeonggi / Busan ...",
  "modal.training.topik": "Cấp độ TOPIK",
  "modal.training.topikPh": "Vui lòng chọn",
  "modal.training.visa": "Loại visa",
  "modal.training.visaPh": "Vui lòng chọn",
  "modal.training.message": "Ghi chú (tùy chọn)",
  "modal.training.messagePh": "Câu hỏi bổ sung",
  "modal.training.submit": "Gửi đăng ký",
  "modal.training.success": "Đã tiếp nhận đăng ký.",
  "modal.training.needLogin":
    "Vui lòng đăng nhập SNS trước. Đang chuyển đến trang đăng nhập.",

  "modal.partnership.title": "Liên hệ hợp tác GLOCARE",
  "modal.partnership.subtitle":
    "Chào mừng đề xuất hợp tác từ trung tâm đào tạo, viện dưỡng lão, doanh nghiệp.",
  "modal.partnership.name": "Người phụ trách",
  "modal.partnership.company": "Tên công ty / tổ chức",
  "modal.partnership.companyPh": "Tên công ty",
  "modal.partnership.phone": "Liên hệ (tùy chọn)",
  "modal.partnership.email": "Email",
  "modal.partnership.emailPh": "name@company.com",
  "modal.partnership.message": "Nội dung đề xuất",
  "modal.partnership.messagePh": "Hãy cho biết lĩnh vực bạn muốn hợp tác",
  "modal.partnership.submit": "Gửi",
  "modal.partnership.success": "Đã tiếp nhận đề xuất hợp tác.",

  "ambassador.eyebrow": "Đại sứ",
  "ambassador.title": "Quyền lợi Đại sứ GLOCARE",
  "ambassador.intro":
    "Tham gia làm đại sứ GLOCARE, bạn có thể chia sẻ thông tin với các học viên khác và nhận hỗ trợ từ các tiền bối đã có chứng chỉ.",
  "ambassador.code.label": "Mã vào nhóm KakaoTalk",
  "ambassador.code.empty": "(Chưa thiết lập — vui lòng liên hệ)",
  "ambassador.qr.label": "QR vào nhóm",
  "ambassador.qr.empty": "(Đang chuẩn bị QR)",
  "ambassador.benefits.title": "Quyền lợi chính",

  "partners.eyebrow": "Đối tác",
  "partners.title": "Đối tác GLOCARE",
  "partners.intro":
    "Thông tin trung tâm đào tạo · viện dưỡng lão · đại học hợp tác. Liên hệ GLOCARE để được tư vấn chi tiết.",
  "partners.tab.training_centers": "Trung tâm đào tạo",
  "partners.tab.care_homes": "Viện dưỡng lão",
  "partners.tab.universities": "Đại học",
  "partners.empty": "Chưa có thông tin.",

  "terms.title": "Điều khoản sử dụng",
  "privacy.title": "Chính sách bảo mật",
  "legal.last_updated": "Cập nhật lần cuối",

  "resume.eyebrow": "Tạo CV",
  "resume.title": "AI tạo CV Điều dưỡng viên cho bạn",
  "resume.intro":
    "Hãy điền thông tin và trải nghiệm — AI sẽ chỉnh sửa và tạo CV PDF theo mẫu chuẩn.",
  "resume.list.title": "CV của tôi",
  "resume.list.empty": "Chưa có CV nào.",
  "resume.list.new": "+ Tạo CV mới",
  "resume.list.status.draft": "Bản nháp",
  "resume.list.status.generating": "Đang tạo...",
  "resume.list.status.ready": "Hoàn tất",
  "resume.list.status.failed": "Thất bại",
  "resume.locked.title": "Chỉ dành cho thành viên",
  "resume.locked.desc":
    "Tạo CV chỉ dành cho thành viên 'Welcome Pack' hoặc 'Đào tạo + Welcome Pack'.",
  "resume.locked.cta": "Đăng ký khóa đào tạo",

  "resume.form.section.basic": "Thông tin cơ bản",
  "resume.form.section.profile": "Thông tin bổ sung",
  "resume.form.section.education": "Học vấn",
  "resume.form.section.experience": "Kinh nghiệm (tùy chọn)",
  "resume.form.section.certs": "Chứng chỉ / Giải thưởng (tùy chọn)",
  "resume.form.section.skills": "Kỹ năng / Ngoại ngữ",
  "resume.form.section.activities": "Hoạt động khác (tùy chọn)",
  "resume.form.section.intro": "Giới thiệu bản thân",
  "resume.form.agree": "Tôi đồng ý thu thập và sử dụng thông tin cá nhân *",
  "resume.form.name_vi": "Họ tên (tiếng Việt) *",
  "resume.form.name_vi_ph": "NGUYEN VAN A",
  "resume.form.name_ko": "Họ tên (Hangul) *",
  "resume.form.name_ko_ph": "응우옌 반 안",
  "resume.form.birth": "Ngày sinh",
  "resume.form.phone": "Số điện thoại Hàn Quốc *",
  "resume.form.phone_ph": "010-1234-5678",
  "resume.form.email": "Email *",
  "resume.form.email_ph": "name@example.com",
  "resume.form.address": "Địa chỉ tại Hàn Quốc",
  "resume.form.address_ph": "Seoul Gwangjin-gu Neungdong-ro 120, Tòa Sáng tạo P.202",
  "resume.form.photo": "Ảnh CV (tùy chọn)",
  "resume.form.photo_hint": "Khuyến nghị ảnh chính diện (JPG/PNG)",
  "resume.form.motto": "Bạn muốn trở thành điều dưỡng viên thế nào?",
  "resume.form.motto_ph":
    "Ví dụ: Điều dưỡng viên tỉ mỉ luôn nhận ra trước nhất những bất tiện của người cao tuổi",
  "resume.form.education_ph":
    "Ví dụ: Đại học Hàn Quốc / Khoa Quản trị / Tốt nghiệp 2023\nVí dụ: Cao học Đại học Hàn Quốc / Thạc sĩ Kinh tế / Dự kiến tốt nghiệp 2025",
  "resume.form.experience_ph":
    "Nơi làm / Thời gian / Vị trí / Chi tiết công việc\nVí dụ: GLOCARE / 5/2024 - 10/2025 / Marketing / Sản xuất video TikTok, dịch tiếng Việt",
  "resume.form.certs_ph":
    "Tên / Cơ quan cấp / Ngày cấp\nVí dụ: Chứng chỉ Điều dưỡng viên / Korea Health Personnel Licensing Examination Institute / 8/2025\nVí dụ: TOPIK Cấp 4 / Viện Giáo dục Quốc tế / 8/2025",
  "resume.form.skills_ph":
    "Tên / Trình độ\nVí dụ: Tiếng Hàn / Giao tiếp hàng ngày\nVí dụ: Tiếng Việt / Tiếng mẹ đẻ\nVí dụ: Soạn thảo văn bản (Word, Excel) / Trung cấp",
  "resume.form.activities_ph":
    "Tên hoạt động / Thời gian / Tổ chức / Chi tiết\nVí dụ: Tình nguyện viện dưỡng lão / 1/2025 - 3/2026 / Viện dưỡng lão Hàn Quốc / Mỗi Chủ nhật, hỗ trợ ăn uống cho người cao tuổi",
  "resume.form.episode": "Kỷ niệm / kinh nghiệm khi học hoặc thực tập",
  "resume.form.episode_ph":
    "Vui lòng viết tự do về trải nghiệm hoặc ví dụ cụ thể khiến bạn muốn trở thành điều dưỡng viên. AI sẽ chỉnh sửa thành phần giới thiệu bản thân.",
  "resume.form.submit": "Tạo CV",
  "resume.form.submitting": "AI đang viết... (10-30s)",

  "resume.view.download": "Tải PDF",
  "resume.view.delete": "Xóa",
  "resume.view.delete_confirm": "Bạn muốn xóa CV này?",
  "resume.view.failed":
    "Tạo CV thất bại. Vui lòng thử lại.",
  "resume.view.generating":
    "AI đang tạo CV. Vui lòng tải lại trang sau ít phút.",

  "videos.eyebrow": "Video đào tạo",
  "videos.title": "Video tài liệu bổ sung tiếng Việt",
  "videos.intro":
    "Video bổ sung giải thích các khái niệm chính và thuật ngữ y học bằng tiếng Việt. Trạng thái đã xem được tự động lưu.",
  "videos.tag.all": "Tất cả",
  "videos.watched": "Đã xem",
  "videos.unwatched": "Chưa xem",
  "videos.empty": "Chưa có video.",
  "videos.locked.title": "Chỉ dành cho thành viên",
  "videos.locked.desc":
    "Video đào tạo chỉ dành cho thành viên 'Đào tạo' hoặc 'Đào tạo + Welcome Pack'.",
  "videos.player.back": "← Về danh sách",
  "videos.player.mark_watched": "Đánh dấu đã xem",
  "videos.player.unmark_watched": "Bỏ đánh dấu",

  "cbt.eyebrow": "Luyện thi CBT",
  "cbt.title": "Ôn thi chứng chỉ Điều dưỡng viên",
  "cbt.intro":
    "Ngẫu nhiên 30 câu hỏi từ ngân hàng 1.688 câu. Có thể chọn chương hoặc làm toàn bộ.",
  "cbt.chapter.all": "Tất cả",
  "cbt.chapter.label": "Chương",
  "cbt.chapter.mock": "Đề thi mẫu (hình ảnh)",
  "cbt.start": "Bắt đầu",
  "cbt.recent": "Lần làm gần nhất",
  "cbt.score": "Điểm",
  "cbt.no_attempts": "Chưa có lịch sử làm bài.",
  "cbt.locked.title": "Chỉ dành cho thành viên",
  "cbt.locked.desc":
    "Tính năng luyện thi CBT chỉ dành cho thành viên 'Đào tạo' hoặc 'Đào tạo + Welcome Pack'.",
  "cbt.locked.cta": "Đăng ký khóa đào tạo",
  "cbt.quiz.q": "Câu",
  "cbt.quiz.of": "/",
  "cbt.quiz.unanswered": "Chưa trả lời",
  "cbt.quiz.submit": "Xem kết quả",
  "cbt.quiz.confirm_unanswered":
    "Có câu chưa trả lời. Bạn vẫn muốn nộp bài?",
  "cbt.quiz.previous": "Trước",
  "cbt.quiz.next": "Tiếp",
  "cbt.result.title": "Kết quả",
  "cbt.result.correct": "Đáp án đúng",
  "cbt.result.your_answer": "Bạn chọn",
  "cbt.result.intent": "Ý định câu hỏi",
  "cbt.result.explanation": "Giải thích lựa chọn",
  "cbt.result.terms": "Thuật ngữ chính",
  "cbt.result.retry": "Làm lại",

  "login.title": "Đăng nhập",
  "login.desc": "Đăng nhập nhanh bằng tài khoản SNS",
  "login.google": "Tiếp tục với Google",
  "login.facebook": "Tiếp tục với Facebook",

  "footer.privacy": "Chính sách bảo mật",
  "footer.terms": "Điều khoản sử dụng",
  "footer.copyright": "© 2026 GLOCARE. All rights reserved.",
};

const dict: Record<Locale, DictShape> = { ko: koDict, vi: viDict };

export type Dict = DictShape;
export type DictKey = keyof Dict;

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get("locale")?.value;
  if (v === "ko" || v === "vi") return v;
  return DEFAULT_LOCALE;
}

export async function getDict(): Promise<Dict> {
  const locale = await getLocale();
  return dict[locale];
}

export function getDictByLocale(locale: Locale): Dict {
  return dict[locale];
}

export function t(locale: Locale, key: DictKey): string {
  return dict[locale][key];
}
