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
  "home.cta.training": "요양보호사 교육 신청",
  "home.cta.partner": "글로케어 제휴 문의",

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
  "home.cta.training": "Đăng ký khóa đào tạo",
  "home.cta.partner": "Liên hệ hợp tác",

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
