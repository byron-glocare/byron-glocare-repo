/**
 * 유학생 비자 서류 체크리스트 (재편성판 · 속성 틀 포함).
 *
 * 대상: 유학생(학위 D-2 / 어학당 D-4-1)만. 장학·교환학생·기업연수 등 예외 경로 제외.
 * 근거: docs/visa requirement/rules.json + 유학생_인증등급_조합_매트릭스.md.
 * 원칙:
 *  - "체류자격" 대신 "비자". 공식 서류명은 유지, 수식어는 일상어.
 *  - 같은 사람 것을 내야 하면 반복 서술 대신 연결(holderSameAs)로 표기.
 *  - 모든 서류는 발급기관·형식·명의 등 속성을 채운다(해당 없으면 비움).
 */

export type Course = "univ" | "hagwon"; // 학위(D-2) / 어학당(D-4-1)
export type Tier = "excellent" | "certified" | "general" | "consulting" | "restricted";
export type Burden = "exempt" | "admission" | "full" | "blocked";
export type Region = "metro" | "nonmetro";
export type Section = "신분·공통" | "학력" | "재정" | "건강" | "어학";

export const SECTIONS: Section[] = ["신분·공통", "학력", "재정", "건강", "어학"];

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

export function judge(course: Course, tier: Tier, region: Region, nationality: string, statusCode: string): Verdict {
  void region;
  const isVN = nationality === "vn";
  const notes: string[] = [];

  if (tier === "restricted") {
    if (course === "hagwon") return blocked("비자정밀 심사대학은 어학연수 비자 발급이 제한됩니다.");
    if (["D-2-1", "D-2-2", "D-2-3"].includes(statusCode))
      return blocked("비자정밀 심사대학은 학사·석사 신규 비자가 제한됩니다(박사·연구과정은 사증발급인정서 경로).");
  }

  const burden: Burden = tier === "excellent" ? "exempt" : tier === "certified" ? "admission" : "full";
  if (tier === "consulting") notes.push("컨설팅대학(비자심사 강화): 재정 예치기간이 6개월로 늘고 어학 성적이 필수입니다.");

  const routes: string[] = [];
  if (course === "hagwon" && (tier === "general" || tier === "consulting" || tier === "restricted") && isVN) {
    routes.push("사증발급인정서 (대학이 대리 신청) — 어학연수는 직접 신청 불가");
  } else {
    routes.push("재외공관 직접 신청");
    if (tier === "excellent") routes.push("사증발급인정서 (선택 가능)");
  }

  let financeCaveat: string | undefined;
  if (isVN && burden === "exempt") {
    financeCaveat = "베트남 남부(호치민 총영사관)는 우수 인증대학이어도 재정 심사를 합니다 → 재정서류를 준비하세요.";
  }

  const stayPeriod = course === "hagwon" ? "최대 6개월 (국내 연장 가능)" : "1~2년";

  return { burden, burdenLabel: BURDEN_META[burden].label, burdenDesc: BURDEN_META[burden].desc, routes, stayPeriod, financeCaveat, notes };

  function blocked(reason: string): Verdict {
    return { burden: "blocked", burdenLabel: BURDEN_META.blocked.label, burdenDesc: BURDEN_META.blocked.desc, routes: [], stayPeriod: "", blockedReason: reason, notes: [] };
  }
}

export function sectionNeeded(section: Section, v: Verdict, course: Course, nationality: string): boolean {
  if (v.burden === "blocked") return false;
  const isVN = nationality === "vn";
  const financeNeeded = v.burden === "full" || isVN; // 고시국(베트남)은 등급 무관 재정 심사
  switch (section) {
    case "신분·공통": return true;
    case "학력": return v.burden !== "exempt";
    case "재정": return financeNeeded;
    case "건강": return isVN;
    case "어학": return course === "hagwon" || v.burden === "full" || v.burden === "admission";
  }
}

/* ── 서류 정의 (속성 틀) ── */
export interface ChecklistDoc {
  id: string;
  name: string; // 공식 명칭
  section: Section;
  courses: Course[];
  brief: string; // 한 줄 핵심(일상어)
  cond?: string; // 조건/대체/유의

  /* 명의 */
  holderSameAs?: string; // 이 서류 id 의 명의자와 동일
  holder?: string; // 직접 명의 표기

  /* 구조화 속성(틀) — 해당 없으면 비움 */
  issuer?: string; // 발급기관
  form?: string; // 원본 / 사본 / 원본+사본
  bringOriginal?: boolean; // 대조용 원본 지참
  validity?: string; // 유효기간
  translation?: string; // 번역
  notarization?: string; // 공증
  authentication?: string; // 영사확인
  signature?: string; // 서명(친필 등)
  obtainDays?: string; // 발급 소요일(일정 역산)

  detail?: string; // 기타 메모
  ambiguous?: string; // 확인 필요
  onlyVN?: boolean; // 베트남 전용
  onlyNorth?: boolean; // 베트남 북부(하노이 관할) 전용
}

export const DOCS: ChecklistDoc[] = [
  /* ── 신분·공통 ── */
  { id: "passport", name: "여권", section: "신분·공통", courses: ["univ", "hagwon"], brief: "본인 여권.", holder: "본인", issuer: "여권당국", form: "원본", validity: "남은 유효기간 6개월 이상", obtainDays: "미상" },
  { id: "visa-form", name: "비자 신청서", section: "신분·공통", courses: ["univ", "hagwon"], brief: "정해진 양식 작성.", cond: "증명사진(3.5×4.5cm) 1장 부착.", holder: "본인", issuer: "본인 작성", form: "원본", signature: "친필 서명" },
  { id: "id-card", name: "신분증 사본", section: "신분·공통", courses: ["univ", "hagwon"], brief: "본인 신분증.", holder: "본인", issuer: "공안(신분증 발급기관)", form: "사본", translation: "번역 불요(신분증은 번역 제외)", onlyVN: true },
  { id: "admission", name: "표준입학허가서", section: "신분·공통", courses: ["univ", "hagwon"], brief: "지원한 대학이 발급하는 입학 확인서.", cond: "연간 유학 비용과 조달 계획(본인·부모 부담)이 금액으로 적힘 → 잔고와 대조됨.", issuer: "대학", form: "원본", validity: "공관 제출용은 별도(대학 단계와 유효기간 다름)", holder: "대학 발급" },
  { id: "univ-reg", name: "대학 사업자등록증 사본", section: "신분·공통", courses: ["univ", "hagwon"], brief: "대학이 주는 서류(고유번호증도 가능).", issuer: "대학", form: "사본", holder: "대학 발급" },
  { id: "family-ct07", name: "가족관계 확인서(CT07)", section: "신분·공통", courses: ["univ", "hagwon"], brief: "가족관계 확인.", issuer: "베트남 공안", form: "원본", signature: "친필 서명 원본만(전자·스캔·인쇄 불가)", onlyVN: true },
  { id: "birth-cert", name: "출생증명서", section: "신분·공통", courses: ["univ", "hagwon"], brief: "부모와의 관계 입증(부모가 재정보증할 때).", holder: "본인", issuer: "인민위원회·공안", form: "사본", translation: "번역 필요", notarization: "공증", onlyVN: true },
  { id: "residence-ct08", name: "거주 확인서(CT08)", section: "신분·공통", courses: ["univ", "hagwon"], brief: "북부 출신이 호치민 총영사관에 접수할 때.", cond: "남부 1년 이상 거주 이력(대체: 남부 6개월 근무·재학 증빙). 남부 고교 졸업 6개월 이내면 면제.", issuer: "베트남 공안", form: "원본", holder: "본인", onlyVN: true, onlyNorth: true },

  /* ── 학력 ── */
  { id: "grad-cert", name: "졸업증명서", section: "학력", courses: ["univ", "hagwon"], brief: "최종 학교 졸업증명서.", cond: "아직 졸업 전이면 졸업예정증명서로 대체(졸업일 1년 이내).", holder: "본인", issuer: "최종 학교", form: "원본", translation: "번역공증 필요", authentication: "남부는 영사확인(외무성 → 총영사관, 접수일 1년 이내)" },
  { id: "transcript", name: "성적증명서", section: "학력", courses: ["univ", "hagwon"], brief: "최종 학교 성적증명서.", holderSameAs: "grad-cert", issuer: "최종 학교", form: "원본", translation: "번역공증 필요", authentication: "졸업증명서와 동일(남부 영사확인)" },

  /* ── 재정 ── */
  { id: "balance", name: "잔고증명서", section: "재정", courses: ["univ", "hagwon"], brief: "통장 잔액 증명.", cond: "학위: 수도권 2,000만·비수도권 1,600만원 / 어학당: 수도권 1,000만·비수도권 800만원 이상. 3개월 이상 예치(어학당·컨설팅대학은 6개월).", holder: "본인 또는 부모(아버지·어머니 중 1명). 삼촌·지인 명의는 원칙적으로 불인정", issuer: "은행", form: "원본", bringOriginal: true, validity: "공관 제출용 10일 / 대학 제출용 30일 — 따로 발급", translation: "베트남 은행 발급이면 번역 필요(국내 은행이면 불요)" },
  { id: "bankbook", name: "통장 사본", section: "재정", courses: ["univ", "hagwon"], brief: "잔고증명서와 같은 통장. 양도받은 통장 불인정.", holderSameAs: "balance", issuer: "은행", form: "사본", bringOriginal: true },
  { id: "remittance", name: "국내송금 증명서", section: "재정", courses: ["univ", "hagwon"], brief: "잔고증명서 대신 한국으로 송금해 재정을 증명할 때.", holderSameAs: "balance", issuer: "은행", form: "원본" },
  { id: "parent-support", name: "부모 재정지원 확인서", section: "재정", courses: ["univ", "hagwon"], brief: "부모가 유학 비용을 대는 경우 제출.", cond: "잔고·소득 증빙은 이 부모(잔고 명의자) 기준으로 맞춤.", holder: "잔고 명의 부모", issuer: "본인·부모 작성 후 공안 확인", form: "원본", translation: "번역 필요", notarization: "관할 공안 확인 필수", onlyVN: true },
  { id: "parent-income", name: "부모 소득·재직 증빙", section: "재정", courses: ["univ", "hagwon"], brief: "잔고 명의 부모 기준, 직업에 따라 준비.", cond: "직장인 → 재직증명·급여내역(최근 3개월)·사회보험 / 사업자 → 사업자등록·납세증명 / 농민 → 소득확인서·부동산(레드북).", holderSameAs: "parent-support", issuer: "회사·세무·공안 등", form: "원본·사본", translation: "번역 필요", notarization: "관할 공안 확인", detail: "부모 1명(보증인) 기준이 원칙, 재정이 빠듯하면 두 분 함께 내면 유리.", ambiguous: "보증인 1명 기준인지 부모 공동인지 원문 불명확.", onlyVN: true },
  { id: "cost-pledge", name: "유학경비 부담 서약서", section: "재정", courses: ["univ", "hagwon"], brief: "누가 유학 비용을 부담하는지 서약.", cond: "보통 입학지원서에 포함됨.", holder: "본인 또는 부모(재정보증인)", issuer: "본인 작성", form: "원본" },
  { id: "deposit-confirm", name: "유학경비 예치확인서", section: "재정", courses: ["hagwon"], brief: "어학당(일반·컨설팅대학) 유학경비 예치제 대상일 때.", cond: "지정 방식으로 예치 후 확인서 원본 제출. 학위과정(D-2)에는 없음.", holder: "본인", issuer: "은행·지정기관", form: "원본" },

  /* ── 건강 ── */
  { id: "tb", name: "결핵진단서", section: "건강", courses: ["univ", "hagwon"], brief: "공관 지정병원에서 발급.", cond: "흉부 X선 검사 포함.", holder: "본인", issuer: "공관 지정병원", form: "원본", validity: "최근 3개월 이내", onlyVN: true },

  /* ── 어학 ── */
  { id: "korean", name: "한국어 성적(TOPIK 등)", section: "어학", courses: ["univ", "hagwon"], brief: "한국어 과정 지원 시.", cond: "학위: 학사 이상 TOPIK 4급·전문학사 3급 / 어학당: 입학 기준에 따름. 인증대학은 권장, 일반·컨설팅대학은 필수. (KIIP·세종학당 수료증으로 대체 가능)", holder: "본인", issuer: "시험기관(TOPIK 등)", form: "원본", detail: "세종학당은 현지 오프라인 과정만 인정(온라인 제외)." },
  { id: "training-plan", name: "연수계획서", section: "어학", courses: ["hagwon"], brief: "어학당 지원 시.", cond: "수업 시간표·강사·시설 등 연수 내용 포함.", issuer: "대학·연수기관", form: "원본" },
  { id: "english", name: "영어 성적", section: "어학", courses: ["univ"], brief: "영어로 수업하는 과정(영어트랙) 지원 시.", cond: "TOEFL 530(iBT 71) / IELTS 5.5 / CEFR B2 / TEPS 327 이상.", holder: "본인", issuer: "시험기관", form: "원본" },
];
