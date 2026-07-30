/**
 * 유학생 비자 서류 체크리스트 (태그 통일판).
 *
 * 대상: 유학생(학위 D-2 / 어학당 D-4-1)만. 장학·교환학생·기업연수 등 예외 경로 제외.
 * 근거: docs/visa requirement/rules.json + 유학생_인증등급_조합_매트릭스.md.
 *
 * 속성(태그) 표기 규칙:
 *  - 값 문자열      → 태그로 노출(접힘=값만, 펼침=종류: 값).
 *  - "★확인불가"    → 해당되지만 자료가 없음 → 접힘 땐 숨김, 펼침 때 "종류: ★확인불가".
 *  - 값이 없음(undefined) → 이 서류엔 원래 해당 없음 → 표시하지 않음.
 */

export type Course = "univ" | "hagwon";
export type Tier = "excellent" | "certified" | "general" | "consulting" | "restricted";
export type Burden = "exempt" | "admission" | "full" | "blocked";
export type Region = "metro" | "nonmetro";
export type Section = "신분·공통" | "학력" | "재정" | "건강" | "어학";

export const SECTIONS: Section[] = ["신분·공통", "학력", "재정", "건강", "어학"];
export const UNVERIFIED = "★확인불가";

/** 태그로 노출하는 속성 종류(순서·라벨). */
export const ATTR_LABELS: { key: keyof ChecklistDoc; label: string }[] = [
  { key: "holder", label: "명의" },
  { key: "issuer", label: "발급기관" },
  { key: "form", label: "형식" },
  { key: "validity", label: "유효기간" },
  { key: "translation", label: "번역" },
  { key: "notarization", label: "공증" },
  { key: "authentication", label: "영사확인" },
  { key: "signature", label: "서명" },
  { key: "obtainDays", label: "발급 예상 소요일" },
];

/* ── 판정: 등급 × 과정 → 부담레벨·경로·제한 ── */
export interface Verdict {
  burden: Burden;
  burdenLabel: string;
  burdenDesc: string;
  routes: string[];
  stayPeriod: string;
  blockedReason?: string;
  financeCaveat?: string;
  notes: string[];
}

const BURDEN_META: Record<Burden, { label: string; desc: string }> = {
  exempt: { label: "서류 면제", desc: "표준입학허가서 중심 — 학력·재정 입증서류 대부분 면제(우수 인증대학)." },
  admission: { label: "허가서 심사", desc: "표준입학허가서 중심 심사(인증대학)." },
  full: { label: "풀세트", desc: "학력·재정 입증서류 전체 제출." },
  blocked: { label: "발급 제한", desc: "이 조합은 신규 비자 발급이 제한됩니다." },
};

/**
 * 판정. 매트릭스(학위과정 등급 × 어학연수 등급 × 과정)에 따름.
 *  - 학위(D-2): 학위과정 등급만 사용.
 *  - 어학당(D-4-1): 학위과정 등급 + 어학연수 등급 둘 다 사용.
 */
export function judge(course: Course, degreeTier: Tier, langTier: Tier, region: Region, nationality: string, statusCode: string): Verdict {
  void region;
  const isVN = nationality === "vn";
  const notes: string[] = [];
  const stay = course === "hagwon" ? "최대 6개월 (국내 연장 가능)" : "1~2년";
  const caveat = (burden: Burden): string | undefined =>
    isVN && burden === "exempt" ? "베트남 남부(호치민 총영사관)는 우수 인증대학이어도 재정 심사를 합니다 → 재정서류를 준비하세요." : undefined;

  const mk = (burden: Burden, routes: string[], financeCaveat?: string): Verdict => ({
    burden,
    burdenLabel: BURDEN_META[burden].label,
    burdenDesc: BURDEN_META[burden].desc,
    routes,
    stayPeriod: stay,
    financeCaveat,
    notes,
  });
  const blocked = (reason: string): Verdict => ({ burden: "blocked", burdenLabel: BURDEN_META.blocked.label, burdenDesc: BURDEN_META.blocked.desc, routes: [], stayPeriod: stay, blockedReason: reason, notes: [] });

  if (course === "hagwon") {
    // 어학당 (D-4-1) — 어학연수 등급이 정밀심사면 발급 제한
    if (langTier === "restricted") return blocked("어학연수 비자정밀 심사대학은 어학연수 비자 발급이 제한됩니다.");
    if (langTier === "consulting" || degreeTier === "consulting") notes.push("컨설팅대학(비자심사 강화): 재정 예치기간 6개월·어학 성적 필수.");
    const burden: Burden = degreeTier === "excellent" ? "exempt" : degreeTier === "certified" && langTier === "certified" ? "admission" : "full";
    const routes = degreeTier === "excellent" ? ["재외공관 직접 신청", "사증발급인정서 (선택 가능)"] : ["재외공관 직접 신청"];
    return mk(burden, routes, caveat(burden));
  }

  // 학위 (D-2) — 학위과정 등급만
  if (degreeTier === "restricted") {
    if (["D-2-1", "D-2-2", "D-2-3"].includes(statusCode)) return blocked("비자정밀 심사대학은 학사·석사 신규 비자가 제한됩니다(박사·연구과정은 사증발급인정서 경로).");
    return mk("full", ["사증발급인정서 (인정서 경로만)"]);
  }
  if (degreeTier === "consulting") notes.push("컨설팅대학(비자심사 강화): 재정 예치기간 6개월·어학 성적 필수.");
  const burden: Burden = degreeTier === "excellent" ? "exempt" : degreeTier === "certified" ? "admission" : "full";
  const routes = ["재외공관 직접 신청"];
  if (degreeTier === "excellent") routes.push("사증발급인정서 (선택 가능)");
  return mk(burden, routes, caveat(burden));
}

export function sectionNeeded(section: Section, v: Verdict, course: Course, nationality: string): boolean {
  if (v.burden === "blocked") return false;
  const isVN = nationality === "vn";
  const financeNeeded = v.burden === "full" || isVN;
  switch (section) {
    case "신분·공통": return true;
    case "학력": return v.burden !== "exempt";
    case "재정": return financeNeeded;
    case "건강": return isVN;
    case "어학": return course === "hagwon" || v.burden === "full" || v.burden === "admission";
  }
}

/**
 * 조건별(★) 값 슬롯 — 조회 조건마다 달라지는 값. 공용 속성과 달리 조건별로 따로 편집.
 * 편집 저장 키: `dyn:{docId}:{slot}`.
 */
export interface CondSlot {
  slot: string; // 문서 내 안정 키
  group: string; // 묶음 이름(예: 예치금)
  label: string; // 조건 설명(예: 학위 · 수도권)
  value: string; // 기본값
}
export const CONDITIONAL_SLOTS: Record<string, CondSlot[]> = {
  balance: [
    { slot: "amount:univ:metro", group: "예치금", label: "학위(D-2) · 수도권", value: "2,000만원" },
    { slot: "amount:univ:nonmetro", group: "예치금", label: "학위(D-2) · 비수도권", value: "1,600만원" },
    { slot: "amount:hagwon:metro", group: "예치금", label: "어학당(D-4) · 수도권", value: "1,000만원" },
    { slot: "amount:hagwon:nonmetro", group: "예치금", label: "어학당(D-4) · 비수도권", value: "800만원" },
    // 예치 기간은 대학 인증 등급에 따라 달라진다.
    { slot: "period:excellent", group: "예치기간", label: "우수인증대학", value: "면제(재정입증 면제)" },
    { slot: "period:certified", group: "예치기간", label: "인증대학", value: "3개월 이상" },
    { slot: "period:general", group: "예치기간", label: "일반(미인증)대학", value: "6개월 이상" },
    { slot: "period:consulting", group: "예치기간", label: "컨설팅대학", value: "6개월 이상" },
  ],
};

type Getter = (path: string, def: string) => string;

/** 잔고증명서: 조회 조건에 맞는 예치금·예치기간 값 태그(조건별 편집값 반영). */
export function balanceTags(course: Course, region: Region, tier: Tier, get?: Getter): string[] {
  const g = get ?? ((_p, d) => d);
  const slots = CONDITIONAL_SLOTS.balance;
  const val = (slot: string) => g(`dyn:balance:${slot}`, slots.find((s) => s.slot === slot)!.value);
  const amountSlot = `amount:${course}:${region}`;
  const tierKey = tier === "excellent" || tier === "certified" || tier === "consulting" ? tier : "general";
  return [`예치금 ${val(amountSlot)} 이상`, `예치 ${val(`period:${tierKey}`)}`];
}

/** 서류의 태그 속성 원본값 목록(공용). holderSameAs·원본지참 반영. get 적용 전 raw. */
export function docAttrRaws(doc: ChecklistDoc, nameOf: (id: string) => string): { key: string; label: string; raw: string }[] {
  const holderVal = doc.holderSameAs ? `${nameOf(doc.holderSameAs)}와 같은 사람` : doc.holder;
  return ATTR_LABELS.map(({ key, label }) => {
    let raw = key === "holder" ? holderVal : (doc[key] as string | undefined);
    if (key === "form" && raw) raw = raw + (doc.bringOriginal ? " · 원본 지참" : "");
    if (raw === undefined) return null;
    return { key: String(key), label, raw };
  }).filter(Boolean) as { key: string; label: string; raw: string }[];
}

/* ── 서류 정의 ── */
export interface ChecklistDoc {
  id: string;
  name: string;
  section: Section;
  courses: Course[];
  brief: string; // 태그 아래 한 줄 설명(접힘)
  detailDesc?: string; // 펼침 시 이어지는 상세 설명(명시 사실 + 실무 팁)
  cond?: string; // 조건/대체(접힘에서도 노출)

  holderSameAs?: string; // 명의를 이 서류 id 와 동일하게
  // ── 속성(태그): 값 / "★확인불가" / 없음 ──
  holder?: string;
  issuer?: string;
  form?: string;
  bringOriginal?: boolean;
  validity?: string;
  translation?: string;
  notarization?: string;
  authentication?: string;
  signature?: string;
  obtainDays?: string;

  ambiguous?: string;
  onlyVN?: boolean;
  onlyNorth?: boolean;
}

const U = UNVERIFIED;

export const DOCS: ChecklistDoc[] = [
  /* ── 신분·공통 ── */
  { id: "passport", name: "여권", section: "신분·공통", courses: ["univ", "hagwon"], brief: "본국 여권.", holder: "본인", issuer: "여권당국", form: "원본", validity: "남은 유효기간 6개월 이상", obtainDays: U, detailDesc: "유효기간이 6개월 미만이면 갱신 후 신청." },
  { id: "visa-form", name: "비자 신청서", section: "신분·공통", courses: ["univ", "hagwon"], brief: "정해진 양식 작성.", holder: "본인", issuer: "본인 작성", form: "원본", validity: U, signature: "친필 서명", detailDesc: "여권 지참. 흰 배경 증명사진 3.5×4.5cm 1장(6개월 이내 촬영) 부착." },
  { id: "id-card", name: "신분증 사본", section: "신분·공통", courses: ["univ", "hagwon"], brief: "본인 신분증.", holder: "본인", issuer: "신분증 발급기관", form: "사본", validity: U, translation: "번역 및 공증", obtainDays: U, onlyVN: true },
  { id: "admission", name: "표준입학허가서", section: "신분·공통", courses: ["univ", "hagwon"], brief: "지원한 대학이 발급하는 입학 확인서.", holder: "대학 발급", issuer: "대학", form: "원본", validity: "공관 제출용은 별도(대학 단계와 유효기간 다름)", obtainDays: U, detailDesc: "대학 입학심사 통과 시 발급. 7·8항에 연간 유학 비용과 조달 계획(본인·부모 부담)이 금액으로 적혀 잔고와 대조됨." },
  { id: "univ-reg", name: "대학 사업자등록증 사본", section: "신분·공통", courses: ["univ", "hagwon"], brief: "대학이 주는 서류(고유번호증도 가능).", holder: "대학 발급", issuer: "대학", form: "사본", validity: U, obtainDays: U },
  { id: "family-ct07", name: "가족관계 확인서(CT07)", section: "신분·공통", courses: ["univ", "hagwon"], brief: "가족관계 확인.", holder: "본인", issuer: "베트남 공안", form: "원본", validity: U, signature: "친필 서명 원본만(전자·스캔·인쇄 불가)", translation: "번역 및 공증", obtainDays: U, onlyVN: true },
  { id: "birth-cert", name: "출생증명서", section: "신분·공통", courses: ["univ", "hagwon"], brief: "부모와의 관계 입증(부모가 재정보증할 때).", holder: "본인", issuer: "인민위원회·공안", form: "사본", validity: U, translation: "번역 및 공증", notarization: "공증", obtainDays: U, onlyVN: true },
  { id: "residence-ct08", name: "거주 확인서(CT08)", section: "신분·공통", courses: ["univ", "hagwon"], brief: "북부 출신이 호치민 총영사관에 접수할 때.", cond: "남부 1년 이상 거주 이력(대체: 남부 6개월 근무·재학). 남부 고교 졸업 6개월 이내면 면제.", holder: "본인", issuer: "베트남 공안", form: "원본", validity: U, translation: "번역 및 공증", obtainDays: U, onlyVN: true, onlyNorth: true },

  /* ── 학력 ── */
  { id: "grad-cert", name: "졸업증명서", section: "학력", courses: ["univ", "hagwon"], brief: "최종 학교 졸업증명서.", cond: "아직 졸업 전이면 졸업예정증명서로 대체(졸업일 1년 이내).", holder: "본인", issuer: "최종 학교", form: "원본", validity: U, translation: "번역 및 공증", authentication: "남부 영사확인(외무성 → 총영사관, 접수일 1년 이내)", obtainDays: U, detailDesc: "북부(하노이) 관할 영사확인 절차는 다를 수 있음(★확인불가)." },
  { id: "transcript", name: "성적증명서", section: "학력", courses: ["univ", "hagwon"], brief: "최종 학교 성적증명서.", holderSameAs: "grad-cert", issuer: "최종 학교", form: "원본", validity: U, translation: "번역 및 공증", authentication: "졸업증명서와 동일(남부 영사확인)", obtainDays: U },

  /* ── 재정 ── */
  { id: "balance", name: "잔고증명서", section: "재정", courses: ["univ", "hagwon"], brief: "통장 잔액 증명.", holder: "본인 또는 부모(아버지·어머니 중 1명). 삼촌·지인 명의 원칙 불인정", issuer: "은행", form: "원본", bringOriginal: true, validity: "공관 제출용 10일 / 대학 제출용 30일 — 따로 발급", translation: "번역 및 공증", obtainDays: U, detailDesc: "학위: 수도권 2,000·비수도권 1,600만원 / 어학당: 수도권 1,000·비수도권 800만원 이상. 예치 3개월(어학당·컨설팅대학 6개월). 대학용(30일)과 공관용(10일)은 유효기간이 달라 같은 서류를 재사용할 수 없으니 따로 발급받으세요." },
  { id: "bankbook", name: "통장 사본", section: "재정", courses: ["univ", "hagwon"], brief: "잔고증명서와 같은 통장. 양도받은 통장 불인정.", holderSameAs: "balance", issuer: "은행", form: "사본", validity: U, bringOriginal: true, obtainDays: U },
  { id: "remittance", name: "국내송금 증명서", section: "재정", courses: ["univ", "hagwon"], brief: "잔고증명서 대신 한국으로 송금해 재정을 증명할 때.", holderSameAs: "balance", issuer: "은행", form: "원본", validity: U, obtainDays: U },
  { id: "parent-support", name: "부모 재정지원 확인서", section: "재정", courses: ["univ", "hagwon"], brief: "부모가 유학 비용을 대는 경우 제출.", cond: "잔고·소득 증빙은 이 부모(잔고 명의자) 기준으로 맞춤.", holder: "잔고 명의 부모", issuer: "부모 작성", form: "원본", validity: U, translation: "번역 및 공증", notarization: "관할 공안 확인 필수", obtainDays: U, onlyVN: true },
  { id: "parent-income", name: "부모 소득·재직 증빙", section: "재정", courses: ["univ", "hagwon"], brief: "잔고 명의 부모 기준, 직업에 따라 준비.", cond: "직장인 → 재직증명·급여내역(최근 3개월)·사회보험 / 사업자 → 사업자등록·납세증명 / 농민 → 소득확인서·부동산(레드북).", holderSameAs: "parent-support", issuer: "회사·세무·공안 등", form: "원본·사본", validity: U, translation: "번역 및 공증", notarization: "관할 공안 확인", obtainDays: U, detailDesc: "보증인 1명(잔고 명의 부모) 기준이 원칙. 재정이 빠듯하면 두 분 소득을 함께 내면 유리.", ambiguous: "보증인 1명 기준인지 부모 공동인지 원문 불명확.", onlyVN: true },
  { id: "guarantor-id", name: "재정보증인 신분증 사본", section: "재정", courses: ["univ", "hagwon"], brief: "부모 등 재정보증인의 신분증.", cond: "부모 등 재정보증인이 자금을 댈 때(본인 자비 부담이면 불요).", holderSameAs: "parent-support", issuer: "신분증 발급기관", form: "사본", validity: U, translation: "번역 및 공증", obtainDays: U, onlyVN: true },
  { id: "cost-pledge", name: "유학경비 부담 서약서", section: "재정", courses: ["univ", "hagwon"], brief: "누가 유학 비용을 부담하는지 서약.", holder: "본인 또는 부모(재정보증인)", issuer: "본인 작성", form: "원본", validity: U, detailDesc: "보통 입학지원서에 포함됨." },
  { id: "deposit-confirm", name: "유학경비 예치확인서", section: "재정", courses: ["hagwon"], brief: "어학당(일반·컨설팅대학) 유학경비 예치제 대상.", holder: "본인", issuer: "은행·지정기관", form: "원본", validity: U, obtainDays: U, detailDesc: "지정 방식으로 예치 후 확인서 제출. 학위과정(D-2)에는 없음." },

  /* ── 건강 ── */
  { id: "tb", name: "결핵진단서", section: "건강", courses: ["univ", "hagwon"], brief: "공관 지정병원에서 발급.", holder: "본인", issuer: "공관 지정병원", form: "원본", validity: "최근 3개월 이내", obtainDays: U, detailDesc: "흉부 X선 검사 포함. 지정병원 목록은 공관별로 다름.", onlyVN: true },

  /* ── 어학 ── */
  { id: "korean", name: "한국어 성적(TOPIK 등)", section: "어학", courses: ["univ", "hagwon"], brief: "한국어 과정 지원 시.", cond: "학위: 학사 이상 TOPIK 4급·전문학사 3급 / 어학당: 입학 기준. 인증대학은 권장, 일반·컨설팅대학은 필수.", holder: "본인", issuer: "시험기관(TOPIK 등)", form: "원본", validity: U, obtainDays: U, detailDesc: "KIIP·세종학당 수료증으로 대체 가능(세종학당은 현지 오프라인 과정만 인정, 온라인 제외)." },
  { id: "training-plan", name: "연수계획서", section: "어학", courses: ["hagwon"], brief: "어학당 지원 시.", holder: "대학·연수기관", issuer: "대학·연수기관", form: "원본", validity: U, obtainDays: U, detailDesc: "수업 시간표·강사·시설 등 연수 내용 포함." },
  { id: "english", name: "영어 성적", section: "어학", courses: ["univ"], brief: "영어로 수업하는 과정(영어트랙) 지원 시.", cond: "TOEFL 530(iBT 71) / IELTS 5.5 / CEFR B2 / TEPS 327 이상.", holder: "본인", issuer: "시험기관", form: "원본", validity: U, obtainDays: U },
];
void U;
