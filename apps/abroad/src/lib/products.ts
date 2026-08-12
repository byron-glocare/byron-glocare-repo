/**
 * 판매 상품 — 공개 소개 문구.
 *
 * 금액은 DB(study_issuance_pricing.unit_price)가 정본이다. 운영자가 어드민에서
 * 금액을 바꾸면 화면에 즉시 반영되도록, 여기에는 **설명만** 둔다.
 * (금액을 코드에도 적으면 두 곳이 어긋난다.)
 *
 * 카드사 심사 요건:
 *   · 결제 가능한 실제 판매 상품이 공개 URL 에서 확인돼야 한다.
 *   · 구매자가 서비스 제공기간을 인지할 수 있도록 상품 페이지에 명확히 기재해야 한다.
 */

export const PRODUCT_KEYS = ["doc_fullset", "full_consulting"] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

/**
 * 서비스 제공기간 — 결제일부터 결과물 전달까지의 **최대** 기간.
 *
 * 토스 정책상 무형 서비스는 제공기간 6개월 초과 시 입점 불가다. 종합 컨설팅은
 * 지원 학기 일정을 따라가느라 몇 주로 끊기지 않아 최장 3개월로 고지한다.
 * (통상은 훨씬 짧다 — 상품별 duration 문구에 실제 소요를 함께 적는다.)
 */
export const MAX_SERVICE_MONTHS = 3;

export type ProductCopy = {
  key: ProductKey;
  /** 상품 상세 URL 슬러그 */
  slug: string;
  name: string;
  /** 한 줄 요약 */
  tagline: string;
  /** 상세 설명 — 카드사 심사에서 "상품 상세 설명"으로 확인되는 본문 */
  description: string;
  /** 포함 내역 */
  includes: string[];
  /** 포함되지 않는 것 — 분쟁 예방 */
  excludes: string[];
  /** 서비스 제공기간 안내 */
  duration: string;
};

export const PRODUCTS: Record<ProductKey, ProductCopy> = {
  doc_fullset: {
    key: "doc_fullset",
    slug: "document-fullset",
    name: "서류 발급 풀세트",
    tagline: "졸업·성적증명서를 번역·공증·영사확인까지 끝내 드립니다.",
    description:
      "한국 대학 지원에 필요한 졸업증명서와 성적증명서를 본인 대신 발급받고, " +
      "베트남어·한국어 번역과 공증, 주베트남 대한민국공관의 영사확인까지 한 번에 진행합니다. " +
      "학생은 필요한 정보만 입력하면 되고, 발급기관 방문·번역업체 섭외·공증·영사확인 절차를 " +
      "글로케어가 대행합니다. 완료된 서류는 스캔본으로 먼저 전달하고 원본은 지정하신 곳으로 보내드립니다.",
    includes: [
      "졸업증명서 발급 대행",
      "성적증명서 발급 대행",
      "번역 (베트남어 → 한국어)",
      "공증",
      "영사확인",
      "완료 서류 스캔본 전달 및 원본 발송",
    ],
    excludes: [
      "대학 지원서·자기소개서 등 작성 서류 대행",
      "발급기관이 요구하는 별도 실비가 추가로 발생하는 경우 (사전 안내 후 진행)",
    ],
    duration: `결제일로부터 최대 ${MAX_SERVICE_MONTHS}개월 이내 (통상 2~4주, 현지 발급기관 사정에 따라 달라질 수 있습니다)`,
  },

  full_consulting: {
    key: "full_consulting",
    slug: "full-consulting",
    name: "유학 준비 종합 컨설팅",
    tagline: "서류 발급부터 지원서 작성까지, 유학 준비 전 과정을 대행합니다.",
    description:
      "‘서류 발급 풀세트’를 포함해 한국 대학 지원에 필요한 준비 전 과정을 담당자가 함께 진행합니다. " +
      "지원 가능한 대학·학과 선정, 모집요강별 제출 서류 확인, 지원서와 자기소개서·수학계획서 등 " +
      "작성 서류 준비, 제출 전 최종 점검까지 포함합니다. 담당자가 배정되어 진행 상황을 안내드립니다.",
    includes: [
      "‘서류 발급 풀세트’ 전 항목",
      "지원 대학·학과 선정 상담",
      "모집요강별 필요 서류 확인 및 준비",
      "지원서·자기소개서·수학계획서 등 작성 서류 준비 지원",
      "제출 서류 최종 점검",
      "담당자 배정 및 진행 상황 안내",
    ],
    excludes: [
      "대학 입학 허가 및 비자 발급 보증 (최종 심사는 대학·출입국관서 권한입니다)",
      "대학 등록금·기숙사비 등 학교에 직접 납부하는 비용",
    ],
    duration: `결제일로부터 최대 ${MAX_SERVICE_MONTHS}개월 이내 (지원 학기 일정에 따라 협의)`,
  },
};

export const PRODUCT_LIST: ProductCopy[] = PRODUCT_KEYS.map((k) => PRODUCTS[k]);

export function productBySlug(slug: string): ProductCopy | null {
  return PRODUCT_LIST.find((p) => p.slug === slug) ?? null;
}

/** 원화 표기 */
export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
