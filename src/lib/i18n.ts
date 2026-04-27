/**
 * 간단한 한/베 dictionary 기반 i18n.
 * cookie 'locale' 또는 ?lang=vi 쿼리로 결정. 기본은 vi (베트남어).
 */

import { cookies } from "next/headers";

export type Locale = "ko" | "vi";
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALES: Locale[] = ["ko", "vi"];

const dict: { ko: Record<string, string>; vi: Record<string, string> } = {
  ko: {
    "nav.home": "홈",
    "nav.about": "소개",
    "nav.universities": "대학교",
    "nav.cases": "취업 사례",
    "nav.centers": "유학 센터",
    "nav.apply": "상담 신청",
    "nav.insurance": "유학생 보험",

    "hero.title": "베트남에서 한국 유학",
    "hero.subtitle": "글로케어가 도와드립니다",

    "apply.title": "유학 상담 신청",
    "apply.description":
      "원하는 학과·지역·시기를 알려주시면, 가장 적합한 대학을 추천해드립니다.",
    "apply.field.name": "이름",
    "apply.field.phone": "전화번호",
    "apply.field.email": "이메일",
    "apply.field.age": "나이",
    "apply.field.dept": "희망 학과",
    "apply.field.center": "소개받은 센터 (선택)",
    "apply.field.message": "메시지",
    "apply.field.recruiting": "취업 연계 희망",
    "apply.submit": "상담 신청",
    "apply.success": "상담 신청이 정상 접수됐습니다. 곧 연락드리겠습니다.",

    "insurance.title": "유학생 보험 신청",
    "insurance.description": "외국인등록번호와 연락처를 입력해주세요.",
    "insurance.field.name": "이름",
    "insurance.field.alien_no": "외국인등록번호",
    "insurance.field.zalo": "Zalo / 전화번호",
    "insurance.field.marketing": "마케팅 정보 수신 동의",
    "insurance.submit": "신청",
    "insurance.success": "보험 신청이 정상 접수됐습니다.",

    "common.loading": "불러오는 중...",
    "common.error": "오류가 발생했습니다.",
    "common.required": "필수 입력",
    "common.optional": "선택",
  },
  vi: {
    "nav.home": "Trang chủ",
    "nav.about": "Giới thiệu",
    "nav.universities": "Trường đại học",
    "nav.cases": "Câu chuyện việc làm",
    "nav.centers": "Trung tâm tư vấn",
    "nav.apply": "Đăng ký tư vấn",
    "nav.insurance": "Bảo hiểm du học",

    "hero.title": "Du học Hàn Quốc từ Việt Nam",
    "hero.subtitle": "Glocare đồng hành cùng bạn",

    "apply.title": "Đăng ký tư vấn du học",
    "apply.description":
      "Cho chúng tôi biết ngành học, khu vực và thời gian bạn mong muốn — chúng tôi sẽ giới thiệu trường phù hợp nhất.",
    "apply.field.name": "Họ và tên",
    "apply.field.phone": "Số điện thoại",
    "apply.field.email": "Email",
    "apply.field.age": "Tuổi",
    "apply.field.dept": "Ngành mong muốn",
    "apply.field.center": "Trung tâm giới thiệu (nếu có)",
    "apply.field.message": "Tin nhắn",
    "apply.field.recruiting": "Mong muốn hỗ trợ việc làm",
    "apply.submit": "Gửi đăng ký",
    "apply.success": "Đăng ký tư vấn đã được tiếp nhận. Chúng tôi sẽ sớm liên hệ.",

    "insurance.title": "Đăng ký bảo hiểm du học sinh",
    "insurance.description":
      "Vui lòng nhập số đăng ký người nước ngoài và liên lạc.",
    "insurance.field.name": "Họ và tên",
    "insurance.field.alien_no": "Số đăng ký người nước ngoài",
    "insurance.field.zalo": "Zalo / Điện thoại",
    "insurance.field.marketing": "Đồng ý nhận thông tin marketing",
    "insurance.field.required": "Bắt buộc",
    "insurance.submit": "Đăng ký",
    "insurance.success": "Đăng ký bảo hiểm đã được tiếp nhận.",

    "common.loading": "Đang tải...",
    "common.error": "Đã xảy ra lỗi.",
    "common.required": "Bắt buộc",
    "common.optional": "Tùy chọn",
  },
};

export type Dict = (typeof dict)["ko"];
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
