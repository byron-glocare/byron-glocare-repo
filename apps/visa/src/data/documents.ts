/**
 * 서류 마스터 데이터셋 (40종).
 *
 * rules.json(발급요건 룰셋)의 서류 관련 조항 + 재외공관 구비서류 안내를 근거로
 * "서류 1건 = 1 레코드" 로 정규화한 것. 조항(rules)이 "언제/왜/조건"을 담당한다면,
 * 이 파일은 "그 서류 자체의 속성"(발급기관·형식·유효기간·명의·번역/공증/영사확인 등)을 담는다.
 *
 * ⚠ 명의(holder): "본인·부모" 같은 표기가 AND(모두 제출)인지 OR(택1)인지에 따라
 *   준비량이 크게 달라진다. 이 데이터셋은 holder.logic 으로 그 관계를 명시하고,
 *   원문이 불명확하면 holder.ambiguous=true 로 표시한다. UI 에서 반드시 강조할 것.
 *
 * confidence: confirmed=1차/공관 자료 명문, inferred=유추, unknown=미확인.
 * ambiguities: 내가(작성자) 확신하지 못했거나 원문이 모호한 지점.
 */

export type DocCategory =
  | "신청·신분"
  | "가족·거주"
  | "학력"
  | "대학·기관"
  | "재정"
  | "의료"
  | "어학";

/** 발급기관 유형 (12종). */
export type IssuerType =
  | "본인작성"
  | "여권당국"
  | "은행"
  | "공안" // 베트남 공안(경찰)
  | "인민위원회"
  | "학교" // 본국 초·중·고 등 최종학력 학교
  | "본국대학"
  | "한국대학"
  | "지정병원"
  | "세무·사업당국"
  | "회사·법인"
  | "시험기관"
  | "정부·공공기관";

export type FormType = "원본" | "사본" | "원본+사본" | "택일";

/** 명의 주체 코드. parent 는 통칭이 아니라 father/mother 로 풀어 쓴다(모호성 제거). */
export type HolderWho =
  | "self"
  | "father"
  | "mother"
  | "family" // 부모 외 가족(부모 부재 시)
  | "kr_family" // 한국 국적 가족
  | "professor"
  | "company"
  | "institution" // 학교·기관
  | "na";

export interface Holder {
  /** 허용 명의 주체 목록. */
  who: HolderWho[];
  /**
   * who 원소 간 관계.
   *  oneOf = 이 중 "1인" 명의로 준비(택1).
   *  allOf = 나열된 주체 "모두" 각각 제출(AND).
   *  anyOf = 여러 명이어도 되고 1명이어도 됨(합산 가능 등).
   *  na    = 명의 개념 없음.
   */
  logic: "oneOf" | "allOf" | "anyOf" | "na";
  /** 원문이 AND/OR 를 명확히 하지 않아 내가 판단한 경우 true. UI 강조 대상. */
  ambiguous?: boolean;
  note?: string;
}

export interface ValidityStage {
  stage: "공관" | "대학";
  days: number;
  basis?: "발급일" | "신청일" | "접수일";
  note?: string;
}
export interface Validity {
  days?: number;
  basis?: "발급일" | "신청일" | "접수일";
  /** 관문(공관/대학)마다 유효기간이 다른 경우. */
  byStage?: ValidityStage[];
  note?: string;
}

export interface Translation {
  required: boolean;
  langs?: ("ko" | "en")[];
  note?: string;
}
export interface Notarization {
  required: boolean;
  by?: string; // 공증 주체(공증사무소·공안·인민위원회 등)
  note?: string;
}
export interface Authentication {
  required: boolean;
  /** 영사확인 체인(순서). */
  chain?: string[];
  validityDays?: number;
  exemptions?: string[];
  note?: string;
}

export interface VisaDoc {
  id: string;
  name: string;
  category: DocCategory;
  issuer: IssuerType[];
  form: FormType;
  /** 대조용 원본 지참 필요 여부. */
  bringOriginal?: boolean;
  validity?: Validity;
  holder?: Holder;
  translation?: Translation;
  notarization?: Notarization;
  authentication?: Authentication;
  signature?: { handwrittenOnly: boolean; note?: string };
  /** 발급 소요일(일정 역산용). 원문에 거의 없어 대부분 미상. */
  obtainDays?: string;
  /** 이 서류가 필요한 조건(자연어). */
  appliesTo?: string;
  /** 근거가 되는 rules.json 조항 id. */
  ruleRefs?: string[];
  confidence: "confirmed" | "inferred" | "unknown";
  sources?: string[];
  /** 분류·판단이 모호했던 지점(사용자 확인 필요). */
  ambiguities?: string[];
}

export const DOCUMENTS_DATA: VisaDoc[] = [
  /* ══════════ 신청·신분 (3) ══════════ */
  {
    id: "visa-application",
    name: "사증발급신청서",
    category: "신청·신분",
    issuer: ["본인작성"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf", note: "신청 당사자 작성." },
    signature: { handwrittenOnly: true, note: "신청인 서명." },
    appliesTo: "모든 신청 공통. 여권용 표준규격 사진(3.5×4.5cm) 1매 부착.",
    ruleRefs: ["DOC-010"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "passport",
    name: "여권",
    category: "신청·신분",
    issuer: ["여권당국"],
    form: "원본",
    validity: { note: "잔여 유효기간 최소 6개월 이상." },
    holder: { who: ["self"], logic: "oneOf" },
    appliesTo: "모든 신청 공통.",
    ruleRefs: ["DOC-010", "PRC-021"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "id-card",
    name: "신분증 사본",
    category: "신청·신분",
    issuer: ["공안", "정부·공공기관"],
    form: "사본",
    holder: {
      who: ["self"],
      logic: "oneOf",
      ambiguous: true,
      note: "기본서류의 신분증은 통상 '본인'. 다만 재정보증인(부모·가족·회사대표 등)의 신분증은 재정보증 서류 세트에서 별도로 요구됨 — '본인+보증인' 인지 원문이 딱 잘라 말하지 않음.",
    },
    translation: { required: false, note: "번역공증 대상에서 신분증은 제외(PRC-011)." },
    appliesTo: "모든 신청 공통(본인). 보증인 신분증은 재정보증 유형별로 추가.",
    ruleRefs: ["DOC-010"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
    ambiguities: ["'신분증'이 본인만인지, 재정보증인 것까지 한 항목인지 통합/분리 기준이 애매."],
  },

  /* ══════════ 가족·거주 (3) ══════════ */
  {
    id: "birth-cert",
    name: "출생증명서",
    category: "가족·거주",
    issuer: ["인민위원회", "공안"],
    form: "사본",
    holder: { who: ["self"], logic: "oneOf", note: "가족관계(부모-본인) 입증용. 보증인 경로에 따라 가족관계 입증에 포함." },
    translation: { required: true, langs: ["ko", "en"] },
    notarization: { required: true, by: "공증사무소/인민위원회" },
    appliesTo: "가족관계 입증이 필요한 경우(부모 외 가족 보증 등).",
    ruleRefs: ["DOC-024", "PRC-011"],
    confidence: "inferred",
    sources: ["hcmc_2024"],
    ambiguities: ["항상 필수인지, 특정 재정보증 경로에서만 필수인지 불명확."],
  },
  {
    id: "ct07",
    name: "CT07 (호적/가족관계 서식)",
    category: "가족·거주",
    issuer: ["공안"],
    form: "원본",
    signature: { handwrittenOnly: true, note: "친필 서명 원본만 인정. 전자·스캔·인쇄본 불가." },
    holder: { who: ["self"], logic: "oneOf", note: "본인 기준 가족관계." },
    appliesTo: "베트남 국적 신청 공통.",
    ruleRefs: ["DOC-011"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "ct08",
    name: "CT08 (거주확인 서식)",
    category: "가족·거주",
    issuer: ["공안"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    appliesTo: "북부 출신이 남부(호치민 총영사관)에 접수 시, 남부 1년 이상 거주 이력 증빙(대체: 6개월 근무·재학 증빙).",
    ruleRefs: ["DOC-040"],
    confidence: "confirmed",
    sources: ["hcmc_2024"],
  },

  /* ══════════ 학력 (4) ══════════ */
  {
    id: "grad-cert",
    name: "졸업증명서",
    category: "학력",
    issuer: ["학교", "본국대학"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    translation: { required: true, langs: ["ko", "en"] },
    authentication: {
      required: true,
      chain: ["호치민 외무성", "주호치민 총영사관"],
      validityDays: 365,
      note: "남부(호치민) 관할 기준. 하노이 관할은 절차 상이 가능.",
    },
    appliesTo: "최종학력 입증(정식 졸업).",
    ruleRefs: ["DOC-010", "PRC-012"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
    ambiguities: ["하노이 대사관 관할의 영사확인 체인은 미확인."],
  },
  {
    id: "transcript",
    name: "성적증명서",
    category: "학력",
    issuer: ["학교", "본국대학"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    translation: { required: true, langs: ["ko", "en"] },
    authentication: { required: true, chain: ["호치민 외무성", "주호치민 총영사관"], validityDays: 365, note: "생활기록부 포함." },
    appliesTo: "학력·성적 입증. 교환·방문학생은 본국 대학 성적표. 국내 변경 시 직전 어학연수 출석률·성적.",
    ruleRefs: ["PRC-012", "DOC-030", "DOC-050"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "expected-grad-cert",
    name: "졸업예정(임시졸업)증명서",
    category: "학력",
    issuer: ["학교", "본국대학"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    validity: { note: "표준입학허가서 발급일 기준 졸업일로부터 1년 이내만 인정." },
    translation: { required: true, langs: ["ko", "en"] },
    authentication: { required: true, chain: ["호치민 외무성", "주호치민 총영사관"], validityDays: 365 },
    appliesTo: "졸업예정자. 제출 시 체류기간 1년으로 단축, 사증·입국은 최종학기.",
    ruleRefs: ["PRC-013", "DUR-011", "ADM-080"],
    confidence: "confirmed",
    sources: ["moe_standard_2025", "hcmc_cur"],
  },
  {
    id: "home-univ-enrollment",
    name: "본국 대학 재학증명서",
    category: "학력",
    issuer: ["본국대학"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    translation: { required: true, langs: ["ko", "en"] },
    authentication: { required: true, chain: ["호치민 외무성", "주호치민 총영사관"], validityDays: 365 },
    appliesTo: "교환학생(D-2-6)·방문학생(D-2-8).",
    ruleRefs: ["DOC-030", "PRC-012"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },

  /* ══════════ 대학·기관 (5) ══════════ */
  {
    id: "standard-admission",
    name: "표준입학허가서",
    category: "대학·기관",
    issuer: ["한국대학"],
    form: "원본",
    holder: { who: ["institution"], logic: "na", note: "대학이 발급." },
    validity: { note: "공관 사증심사 단계 유효기간 별도. 7·8항에 연간 소요경비·조달계획(본인/보증인/장학) 금액 기재 → 잔고와 대조." },
    appliesTo: "모든 유학·연수(대학 입학심사 통과 시).",
    ruleRefs: ["DOC-010", "ADM-010", "ADM-020", "ADM-021", "ADM-022", "ADM-031", "ADM-040", "ADM-050", "ADM-051", "ADM-052", "ADM-053", "ADM-054", "ADM-060", "ADM-061", "ADM-080"],
    confidence: "confirmed",
    sources: ["moe_standard_2025", "hcmc_cur"],
  },
  {
    id: "univ-biz-reg",
    name: "한국 대학 사업자등록증",
    category: "대학·기관",
    issuer: ["한국대학"],
    form: "사본",
    holder: { who: ["institution"], logic: "na", note: "고유번호증 사본으로 갈음 가능." },
    appliesTo: "모든 신청 공통(대학 실재 확인).",
    ruleRefs: ["DOC-010"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "training-plan",
    name: "연수계획서",
    category: "대학·기관",
    issuer: ["한국대학", "정부·공공기관"],
    form: "원본",
    holder: { who: ["institution"], logic: "na", note: "강의시간표·강사구성·연수시설 등 포함." },
    appliesTo: "연수·학업계획 제출이 필요한 경우(주로 D-2 학업계획).",
    ruleRefs: ["DOC-012"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
    ambiguities: ["어학연수(D-4)에도 동일 형태로 요구되는지 범위 불명확."],
  },
  {
    id: "exchange-agreement",
    name: "학생교류협정서(MOU)",
    category: "대학·기관",
    issuer: ["본국대학", "한국대학"],
    form: "사본",
    holder: { who: ["institution"], logic: "na", note: "대학 간 체결 협정·공문." },
    appliesTo: "교환학생(D-2-6)·방문학생(D-2-8).",
    ruleRefs: ["DOC-030"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "recommendation",
    name: "추천서(파견 결정서)",
    category: "대학·기관",
    issuer: ["본국대학"],
    form: "원본",
    holder: { who: ["institution"], logic: "na", note: "본국 대학의 장 명의." },
    appliesTo: "교환·방문학생.",
    ruleRefs: ["DOC-030"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },

  /* ══════════ 재정 (20) — 준비 부담의 절반이 여기 몰림 ══════════ */
  {
    id: "bank-balance",
    name: "은행 잔고증명서",
    category: "재정",
    issuer: ["은행"],
    form: "원본",
    bringOriginal: true,
    validity: {
      byStage: [
        { stage: "공관", days: 10, basis: "접수일", note: "자료충돌: 현행 간소화판은 최근 1개월, 2024-09-26판은 접수 10일. 보수적으로 10일." },
        { stage: "대학", days: 30, basis: "신청일", note: "명시 유효기간 있으면 그 기간까지, 발급일로부터 최대 6개월." },
      ],
      note: "관문별 유효기간이 달라 대학 제출본을 공관에 재사용 불가 — 별도 발급.",
    },
    holder: {
      who: ["self", "father", "mother"],
      logic: "oneOf",
      note: "본인 또는 부모(=아버지/어머니 중 1인) 명의 중 택1. 삼촌·지인 불가. 부모 부재 시에만 그 외 가족(family) 명의 허용.",
    },
    translation: { required: true, langs: ["ko", "en"], note: "베트남(제3국) 은행 발급 시. 국내 은행 발급이면 불요." },
    appliesTo: "재정능력 입증 의무자. 예치 기준액(수도권 학위 2,000·비수도권 1,600·수도권 어학 1,000·비수도권 어학 800만원) 이상, 최소 예치기간(학위 3개월·어학/컨설팅 6개월).",
    ruleRefs: ["FIN-010", "FIN-011", "FIN-020", "FIN-021", "FIN-022", "FIN-023", "FIN-030", "FIN-031", "FIN-032", "FIN-033", "FIN-034", "FIN-035", "FIN-036", "FIN-040", "FIN-041", "FIN-042", "FIN-043", "FIN-050", "FIN-051", "FIN-053", "FIN-054", "FIN-055", "FIN-080", "ADM-030"],
    confidence: "confirmed",
    sources: ["hcmc_cur", "moe_standard_2025"],
    ambiguities: ["공관단계 발급시점(1개월 vs 10일)이 문서버전 간 충돌."],
  },
  {
    id: "bankbook-copy",
    name: "통장 사본",
    category: "재정",
    issuer: ["은행"],
    form: "사본",
    bringOriginal: true,
    holder: { who: ["self", "father", "mother"], logic: "oneOf", note: "잔고증명서와 동일 명의. 양도받은 통장 불인정." },
    appliesTo: "잔고증명서와 함께 제출(대조용 통장 원본 지참).",
    ruleRefs: ["FIN-052"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "domestic-remittance",
    name: "국내송금 증명서",
    category: "재정",
    issuer: ["은행"],
    form: "원본",
    holder: { who: ["self", "father", "mother"], logic: "oneOf", note: "잔고증명서 대체 가능 서류." },
    appliesTo: "잔고증명서 대신 국내(한국) 송금으로 재정 입증하는 경우.",
    ruleRefs: ["ADM-031"],
    confidence: "confirmed",
    sources: ["moe_standard_2025"],
  },
  {
    id: "parent-support-letter",
    name: "부모 재정지원 확인서",
    category: "재정",
    issuer: ["본인작성", "공안"],
    form: "원본",
    holder: {
      who: ["father", "mother"],
      logic: "oneOf",
      ambiguous: true,
      note: "재정보증인 1인(부 또는 모) 기준으로 해석. 부·모 공동(둘 다) 제출이 필요한지, 1인으로 충분한지 원문이 명확히 하지 않음 → 준비량 좌우.",
    },
    translation: { required: true, langs: ["ko", "en"] },
    notarization: { required: true, by: "관할 공안(공증번역)", note: "관할 공안 확인 필수." },
    appliesTo: "부모가 재정보증인인 경우.",
    ruleRefs: ["DOC-020", "DOC-021"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
    ambiguities: ["부·모 공동 여부(AND) / 1인(OR) 불명확 — 하이라이트 필요."],
  },
  {
    id: "income-cert",
    name: "소득확인서",
    category: "재정",
    issuer: ["본인작성", "공안"],
    form: "원본",
    holder: { who: ["father", "mother"], logic: "oneOf", ambiguous: true, note: "재정보증인(부모) 명의. 부·모 공동/택1 여부 불명확." },
    translation: { required: true, langs: ["ko", "en"] },
    notarization: { required: true, by: "관할 공안", note: "농민의 경우 공안이 직업·소득을 확인." },
    appliesTo: "부모가 사업자·자영업·농민인 경우 소득 입증.",
    ruleRefs: ["DOC-021", "DOC-022", "DOC-023"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "labor-contract",
    name: "근로계약서",
    category: "재정",
    issuer: ["회사·법인"],
    form: "사본",
    holder: { who: ["father", "mother"], logic: "oneOf", note: "직장인 부모(재정보증인)의 근로계약." },
    appliesTo: "재정보증인 부모가 직장인인 경우.",
    ruleRefs: ["DOC-020"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "social-insurance",
    name: "사회보험(VssID)",
    category: "재정",
    issuer: ["정부·공공기관"],
    form: "사본",
    holder: { who: ["father", "mother"], logic: "oneOf", note: "직장인 부모. 근무 중인 CT08 대체증빙에서도 필수." },
    appliesTo: "재정보증인 부모가 직장인(또는 남부 근무 증빙 시).",
    ruleRefs: ["DOC-020", "DOC-040"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "salary-statement",
    name: "급여 계좌거래내역서",
    category: "재정",
    issuer: ["은행"],
    form: "원본",
    validity: { note: "최근 3개월(월급 입금 포함)." },
    holder: { who: ["father", "mother"], logic: "oneOf", note: "직장인 부모 급여계좌." },
    appliesTo: "재정보증인 부모가 직장인인 경우.",
    ruleRefs: ["DOC-020"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "vn-biz-reg",
    name: "사업자등록증(베트남)",
    category: "재정",
    issuer: ["세무·사업당국"],
    form: "사본",
    holder: { who: ["father", "mother", "company"], logic: "oneOf", note: "부모의 사업체(사업자/자영업)." },
    translation: { required: true, langs: ["ko", "en"] },
    appliesTo: "재정보증인 부모가 사업자·자영업인 경우.",
    ruleRefs: ["DOC-021", "DOC-022"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "tax-cert",
    name: "납세증명서",
    category: "재정",
    issuer: ["세무·사업당국"],
    form: "원본",
    validity: { note: "최근 3개월 내 부가가치세 또는 가장 최근 몬바이(Môn bài)세." },
    holder: { who: ["father", "mother", "company"], logic: "oneOf" },
    translation: { required: true, langs: ["ko", "en"] },
    appliesTo: "재정보증인 부모가 사업자·자영업인 경우.",
    ruleRefs: ["DOC-021", "DOC-022"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "red-book",
    name: "레드북(부동산 소유 입증)",
    category: "재정",
    issuer: ["인민위원회"],
    form: "사본",
    holder: { who: ["father", "mother"], logic: "oneOf", note: "농민 부모 자산 입증." },
    translation: { required: true, langs: ["ko", "en"] },
    notarization: { required: true, by: "관할 인민위원회", note: "인민위원회 공증 필수." },
    appliesTo: "재정보증인 부모가 농민인 경우.",
    ruleRefs: ["DOC-023"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "financial-commitment",
    name: "재정부담 확약서",
    category: "재정",
    issuer: ["본인작성"],
    form: "원본",
    holder: {
      who: ["family", "kr_family", "company"],
      logic: "oneOf",
      note: "보증 주체(부모 외 가족·한국 가족·회사) 명의. 회사는 법인인감 날인.",
    },
    signature: { handwrittenOnly: false, note: "회사의 경우 법인인감." },
    appliesTo: "부모 외 가족·한국 국적 가족·회사가 재정보증인인 경우.",
    ruleRefs: ["DOC-024", "DOC-025", "DOC-027"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "seal-cert",
    name: "인감증명서",
    category: "재정",
    issuer: ["정부·공공기관"],
    form: "원본",
    holder: { who: ["kr_family", "professor"], logic: "oneOf", note: "한국 국적 가족 또는 지도교수(본인서명사실확인서로 갈음 가능)." },
    appliesTo: "한국 국적 가족·지도교수가 재정보증인인 경우.",
    ruleRefs: ["DOC-025", "DOC-026"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "employment-cert",
    name: "재직증명서",
    category: "재정",
    issuer: ["회사·법인", "정부·공공기관"],
    form: "원본",
    holder: { who: ["kr_family", "professor"], logic: "oneOf", note: "한국 가족은 재직/사업자등록으로 갈음, 지도교수는 재직증명." },
    appliesTo: "한국 국적 가족·지도교수 보증.",
    ruleRefs: ["DOC-025", "DOC-026"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "corp-seal-cert",
    name: "법인인감증명서",
    category: "재정",
    issuer: ["회사·법인"],
    form: "원본",
    holder: { who: ["company"], logic: "na", note: "보증 회사(한국 본사) 법인." },
    appliesTo: "회사(한국 본사·베트남 지사)가 재정보증인인 경우.",
    ruleRefs: ["DOC-027"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "investment-cert",
    name: "투자증명서",
    category: "재정",
    issuer: ["세무·사업당국"],
    form: "사본",
    holder: { who: ["company"], logic: "na", note: "베트남 지사 투자증명." },
    appliesTo: "회사 보증(한국 본사–베트남 지사 장학생 선발) 시.",
    ruleRefs: ["DOC-027"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "deposit-confirmation",
    name: "유학경비 예치확인서",
    category: "재정",
    issuer: ["은행", "정부·공공기관"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf", note: "유학경비 예치제(지급유보) 예치확인." },
    appliesTo: "일반·컨설팅대학 어학연수(중점관리국) — 유학경비 예치제 대상. D-2 학위과정 미적용.",
    ruleRefs: ["FIN-070"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "asset-cert",
    name: "자산증명서",
    category: "재정",
    issuer: ["은행", "인민위원회"],
    form: "원본",
    holder: { who: ["family"], logic: "oneOf", note: "부모 외 가족 보증인의 자산 입증." },
    appliesTo: "부모 외 가족이 재정보증인인 경우.",
    ruleRefs: ["DOC-024"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
  {
    id: "study-cost-pledge",
    name: "유학경비 부담 서약서",
    category: "재정",
    issuer: ["본인작성"],
    form: "원본",
    holder: { who: ["self", "father", "mother", "family"], logic: "oneOf", note: "본인 또는 재정보증인. 입학지원서에 포함되기도 함." },
    appliesTo: "대학 입학 재정심사 제출서류(재정보증인 경우).",
    ruleRefs: ["ADM-031"],
    confidence: "confirmed",
    sources: ["moe_standard_2025"],
  },
  {
    id: "scholarship-cert",
    name: "장학증서",
    category: "재정",
    issuer: ["한국대학", "정부·공공기관"],
    form: "원본",
    holder: { who: ["institution"], logic: "na", note: "전액장학·GKS는 재정증명 갈음/면제. 부분장학은 본인부담분 별도 입증." },
    appliesTo: "장학금 수혜자(전액/부분/GKS).",
    ruleRefs: ["FIN-060", "FIN-061", "FIN-063", "ADM-031"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },

  /* ══════════ 의료 (1) ══════════ */
  {
    id: "tb-cert",
    name: "결핵진단서",
    category: "의료",
    issuer: ["지정병원"],
    form: "원본",
    validity: { days: 90, basis: "발급일", note: "최근 3개월 이내." },
    holder: { who: ["self"], logic: "oneOf" },
    appliesTo: "베트남(결핵고위험국) 신청 공통. 교환·방문은 체류 3개월 이상 시.",
    ruleRefs: ["PRC-014", "DOC-010", "DOC-030"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
    ambiguities: ["공관 지정병원 목록은 공관·시기별로 상이."],
  },

  /* ══════════ 어학 (4) ══════════ */
  {
    id: "topik",
    name: "TOPIK 성적",
    category: "어학",
    issuer: ["시험기관"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    appliesTo: "한국어 과정. 전문학사 3급·학사이상 4급·교환 2급(과정별). 컨설팅·정밀대학은 필수, 인증·일반은 가점.",
    ruleRefs: ["LNG-020", "LNG-021", "LNG-022", "LNG-010", "LNG-011", "LNG-040", "LNG-050", "LNG-060"],
    confidence: "confirmed",
    sources: ["hcmc_cur", "moe_standard_2025"],
  },
  {
    id: "kiip",
    name: "사회통합프로그램(KIIP) 이수/사전평가",
    category: "어학",
    issuer: ["정부·공공기관"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    appliesTo: "TOPIK 대체 인정(단계 이수 또는 사전평가 점수). 등급별 기준 상이.",
    ruleRefs: ["LNG-020", "LNG-021", "ADM-053"],
    confidence: "confirmed",
    sources: ["moe_standard_2025"],
  },
  {
    id: "sejong-cert",
    name: "세종학당 수료증",
    category: "어학",
    issuer: ["정부·공공기관", "시험기관"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf", note: "현지 세종학당 오프라인 기본과정 수료증만 인정. 온라인 세종학당 제외." },
    appliesTo: "TOPIK 대체 인정(중급1/중급2/초급2 등 과정별).",
    ruleRefs: ["LNG-020", "LNG-021", "ADM-053"],
    confidence: "confirmed",
    sources: ["moe_standard_2025"],
  },
  {
    id: "english-test",
    name: "영어시험 성적",
    category: "어학",
    issuer: ["시험기관"],
    form: "원본",
    holder: { who: ["self"], logic: "oneOf" },
    appliesTo: "영어트랙(영어사용과정). TOEFL 530(iBT 71)/IELTS 5.5/CEFR B2/TEPS 327.",
    ruleRefs: ["LNG-030", "ADM-050"],
    confidence: "confirmed",
    sources: ["hcmc_cur"],
  },
];

/** 카테고리 표시 순서. */
export const DOC_CATEGORY_ORDER: DocCategory[] = [
  "신청·신분",
  "가족·거주",
  "학력",
  "대학·기관",
  "재정",
  "의료",
  "어학",
];

/** 명의(holder) AND/OR 가 준비량을 좌우하거나 원문이 모호한 서류 — UI 강조 대상. */
export const HOLDER_SENSITIVE = DOCUMENTS_DATA.filter(
  (d) => d.holder && (d.holder.ambiguous || (d.holder.who.length > 1 && d.holder.logic !== "na"))
).map((d) => d.id);

