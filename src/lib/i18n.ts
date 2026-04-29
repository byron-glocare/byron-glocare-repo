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
