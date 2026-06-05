/**
 * 한/베 dictionary 기반 i18n.
 * cookie 'locale' 또는 ?lang=vi 쿼리로 결정. 기본은 vi (베트남어).
 */

export type Locale = "ko" | "vi";
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALES: Locale[] = ["ko", "vi"];

const koDict = {
    "lang.vi": "Tiếng Việt",
    "lang.ko": "한국어",

    // 외부 어드민(유학센터) chrome
    "center.brand": "GLOCARE 센터",
    "center.nav.overview": "대시보드",
    "center.nav.students": "학생",
    "center.nav.admissions": "모집요강",
    "center.nav.invoices": "청구서",
    "center.logout": "로그아웃",

    "nav.cases": "취업 사례",
    "nav.universities": "제휴 대학",
    "nav.recruiting": "리크루팅 혜택",
    "nav.centers": "협력 유학센터",
    "nav.insurance": "보험 환급",
    "nav.about": "글로케어",
    "nav.apply": "상담 신청 →",

    "hero.badge": "취업 보장 유학",
    "hero.title.em": "한국에서 배우고",
    "hero.title.line2": "— 졸업 후 바로 취업",
    "hero.subtitle":
      "상담부터 유학, 취업까지 — 글로케어가 최적의 대학과 유학센터를 연결합니다.",
    "hero.cta.primary": "무료 상담 신청하기",
    "hero.cta.about": "글로케어 소개",

    "section.cases.eyebrow": "취업 사례",
    "section.cases.title.prefix": "실제 ",
    "section.cases.title.em": "취업 성공",
    "section.cases.title.suffix": " 사례",
    "section.cases.desc":
      "글로케어 프로그램을 통해 한국 취업에 성공한 선배들의 이야기입니다.",

    "section.universities.eyebrow": "제휴 대학 / 학과",
    "section.universities.title.prefix": "취업 특화 ",
    "section.universities.title.em": "제휴 대학",
    "section.universities.title.suffix": "",
    "section.universities.desc":
      "취업 비자 지원, 현장실습, 취업 연계 프로그램이 검증된 대학·학과만 선별했습니다.",

    "section.centers.eyebrow": "협력 유학센터",
    "section.centers.title.prefix": "베트남 현지 ",
    "section.centers.title.em": "협력 센터",
    "section.centers.title.suffix": "",
    "section.centers.desc":
      "가까운 글로케어 협력 유학센터를 선택해 방문 상담을 진행하세요.",

    "footer.tagline":
      "외국인 취업 특화 한국 대학·학과 선별 및 베트남 현지 유학센터 연결 전문 기업",
    "footer.h.services": "서비스",
    "footer.h.company": "회사",
    "footer.h.contact": "문의",
    "footer.about": "글로케어 소개",
    "footer.partner": "파트너십 문의",
    "footer.copyright": "© 2025 글로케어(GloCare). All rights reserved.",
    "footer.privacy": "개인정보처리방침",
    "footer.terms": "이용약관",

    "apply.title": "무료 상담 신청",
    "apply.description":
      "아래 정보를 입력하시면 담당자가 빠르게 연락드립니다.",
    "apply.field.name": "이름",
    "apply.field.phone": "연락처",
    "apply.field.email": "연락처 또는 이메일",
    "apply.field.age": "나이",
    "apply.field.dept": "관심 학과",
    "apply.field.center": "거주 지역",
    "apply.field.message": "문의 사항",
    "apply.field.recruiting": "리크루팅 프로그램 참여",
    "apply.submit": "상담 신청하기",
    "apply.success": "상담 신청이 정상 접수됐습니다. 곧 연락드리겠습니다.",

    "insurance.title": "유학생 보험 환급 신청",
    "insurance.description":
      "아래 정보를 입력해주시면 담당자가 Zalo로 직접 연락드립니다.",
    "insurance.field.name": "이름",
    "insurance.field.alien_no": "외국인 등록번호",
    "insurance.field.zalo": "Zalo 번호",
    "insurance.field.marketing": "마케팅 정보 수신 동의",
    "insurance.submit": "신청하기",
    "insurance.success": "보험 환급 신청이 정상 접수됐습니다.",

    "common.loading": "불러오는 중...",
    "common.error": "오류가 발생했습니다.",
    "common.required": "필수",
    "common.optional": "선택",
};

type DictShape = { readonly [K in keyof typeof koDict]: string };

const viDict: DictShape = {
    "lang.vi": "Tiếng Việt",
    "lang.ko": "한국어",

    // 외부 어드민(유학센터) chrome
    "center.brand": "GLOCARE Center",
    "center.nav.overview": "Tổng quan",
    "center.nav.students": "Sinh viên",
    "center.nav.admissions": "Tuyển sinh",
    "center.nav.invoices": "Hóa đơn",
    "center.logout": "Đăng xuất",

    "nav.cases": "Câu chuyện thành công",
    "nav.universities": "Trường ĐH liên kết",
    "nav.recruiting": "Ưu đãi giới thiệu",
    "nav.centers": "Trung tâm du học",
    "nav.insurance": "Hoàn tiền BH",
    "nav.about": "Về GLOCARE",
    "nav.apply": "Đăng ký tư vấn →",

    "hero.badge": "Du học có việc làm đảm bảo",
    "hero.title.em": "Học tại Hàn Quốc",
    "hero.title.line2": "— Có việc làm ngay khi tốt nghiệp",
    "hero.subtitle":
      "Từ tư vấn, du học đến việc làm ổn định tại Hàn Quốc — GLOCARE kết nối bạn với trường đại học và trung tâm du học phù hợp nhất.",
    "hero.cta.primary": "Đăng ký tư vấn miễn phí",
    "hero.cta.about": "Giới thiệu GLOCARE",

    "section.cases.eyebrow": "Câu chuyện thành công",
    "section.cases.title.prefix": "Những người đã ",
    "section.cases.title.em": "thành công",
    "section.cases.title.suffix": "",
    "section.cases.desc":
      "Câu chuyện của những du học sinh đã tìm được việc làm tại Hàn Quốc qua chương trình GLOCARE.",

    "section.universities.eyebrow": "Trường ĐH & Ngành học",
    "section.universities.title.prefix": "Trường đại học ",
    "section.universities.title.em": "chuyên về việc làm",
    "section.universities.title.suffix": "",
    "section.universities.desc":
      "Chỉ những trường có hỗ trợ visa lao động, thực tập thực tế và chương trình kết nối việc làm đã được kiểm chứng.",

    "section.centers.eyebrow": "Trung tâm đối tác",
    "section.centers.title.prefix": "Trung tâm du học ",
    "section.centers.title.em": "đối tác tại Việt Nam",
    "section.centers.title.suffix": "",
    "section.centers.desc":
      "Hãy chọn trung tâm GLOCARE gần bạn nhất để được tư vấn trực tiếp.",

    "footer.tagline":
      "Chuyên kết nối các trường đại học Hàn Quốc chuyên về việc làm cho người nước ngoài với các trung tâm du học tại Việt Nam.",
    "footer.h.services": "Dịch vụ",
    "footer.h.company": "Công ty",
    "footer.h.contact": "Liên hệ",
    "footer.about": "Giới thiệu GLOCARE",
    "footer.partner": "Hợp tác đối tác",
    "footer.copyright": "© 2025 GLOCARE. Bảo lưu mọi quyền.",
    "footer.privacy": "Chính sách bảo mật",
    "footer.terms": "Điều khoản sử dụng",

    "apply.title": "Đăng ký tư vấn miễn phí",
    "apply.description":
      "Điền thông tin bên dưới — nhân viên tư vấn sẽ liên hệ bạn sớm nhất.",
    "apply.field.name": "Họ và tên",
    "apply.field.phone": "Số điện thoại",
    "apply.field.email": "Điện thoại hoặc Email",
    "apply.field.age": "Tuổi",
    "apply.field.dept": "Ngành học quan tâm",
    "apply.field.center": "Tỉnh / Thành phố cư trú",
    "apply.field.message": "Câu hỏi / Yêu cầu",
    "apply.field.recruiting": "Tham gia chương trình giới thiệu",
    "apply.submit": "Đăng ký tư vấn",
    "apply.success": "Đăng ký tư vấn đã được tiếp nhận. Chúng tôi sẽ sớm liên hệ.",

    "insurance.title": "Đăng ký hoàn tiền bảo hiểm",
    "insurance.description":
      "Điền thông tin bên dưới — nhân viên phụ trách sẽ liên hệ bạn qua Zalo.",
    "insurance.field.name": "Họ và tên",
    "insurance.field.alien_no": "Số đăng ký người nước ngoài",
    "insurance.field.zalo": "Số Zalo",
    "insurance.field.marketing": "Đồng ý nhận thông tin marketing",
    "insurance.submit": "Đăng ký",
    "insurance.success": "Đăng ký bảo hiểm đã được tiếp nhận.",

    "common.loading": "Đang tải...",
    "common.error": "Đã xảy ra lỗi.",
    "common.required": "Bắt buộc",
    "common.optional": "Tùy chọn",
};

const dict: Record<Locale, DictShape> = { ko: koDict, vi: viDict };

export type Dict = DictShape;
export type DictKey = keyof Dict;

export async function getLocale(): Promise<Locale> {
  // 동적 import — next/headers(서버 전용)를 정적 import 하면 이 모듈을 import 하는
  // 클라이언트 컴포넌트 빌드가 깨진다(tr/Locale 만 쓰는 client 도 같이 import 하므로).
  // getLocale 은 서버에서만 호출되므로 런타임 동적 import 로 격리한다.
  const { cookies } = await import("next/headers");
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

/**
 * 인라인 한/베 번역 — 사전 키를 만들 만큼 재사용되지 않는 일회성 UI 문구용.
 *   tr(locale, "학생 목록", "Danh sách sinh viên")
 * 외부 어드민(유학센터) 화면처럼 베트남어가 기본이고 한국어 토글만 필요한 곳에서 사용.
 */
export function tr(locale: Locale, ko: string, vi: string): string {
  return locale === "ko" ? ko : vi;
}
