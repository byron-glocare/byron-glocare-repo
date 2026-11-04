/**
 * 모집요강 PDF 언어판 — 베트남어(brochure-text.ts)와 같은 모양의 한국어 문구·포맷터를 묶어 낸다.
 *   화면·로더는 brochureText(lang) 묶음만 쓴다. 순수 함수만.
 */

import { formatAgeRequirement } from "./age-requirement";
import {
  ALT_PATH_VI,
  APPLIES_TO_VI,
  DOC_COND_VI,
  EDUCATION_VI,
  FEE_VI,
  GLOCARE_INTRO_VI,
  L as L_VI,
  LP_VI,
  SCHEDULE_VI,
  TARGET_VI,
  TUITION_UNIT_VI,
  ageRequirementVi,
  financialVi,
  fmtDate,
  fmtMoney,
  fmtRange,
  gpaVi,
  roundNameVi,
  scholarshipBenefitVi,
  termLabelVi,
  topikVi,
} from "./brochure-text";
import { termLabelKo } from "../study/term-label";

export type BrochureLang = "vi" | "ko";

/** URL 값 → 언어. 기본은 베트남어 */
export const parseBrochureLang = (v: string | null | undefined): BrochureLang => (v === "ko" ? "ko" : "vi");

const VI = {
  lang: "vi" as BrochureLang,
  intro: GLOCARE_INTRO_VI,
  L: L_VI,
  education: EDUCATION_VI,
  altPath: ALT_PATH_VI,
  tuitionUnit: TUITION_UNIT_VI,
  fee: FEE_VI,
  appliesTo: APPLIES_TO_VI,
  schedule: SCHEDULE_VI,
  target: TARGET_VI,
  docCond: DOC_COND_VI,
  lp: LP_VI,
  termLabel: termLabelVi,
  fmtDate,
  fmtMoney,
  fmtRange,
  age: ageRequirementVi,
  gpa: gpaVi,
  topik: topikVi,
  financial: financialVi,
  scholarshipBenefit: scholarshipBenefitVi,
  roundName: roundNameVi,
};

export type BrochureText = typeof VI;

// ── 한국어 포맷 ───────────────────────────────────────────────────────

/** 3287000 → "3,287,000" */
const fmtNumberKo = (n: number): string => {
  const [int, dec] = String(Math.abs(n)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${grouped}${dec ? `.${dec}` : ""}`;
};

/** 원화는 "3,287,000원", 그 밖은 "20,000 USD" */
const fmtMoneyKo = (n: number | null | undefined, currency = "KRW"): string | null => {
  if (n == null || !Number.isFinite(Number(n))) return null;
  const c = currency || "KRW";
  return c === "KRW" ? `${fmtNumberKo(Number(n))}원` : `${fmtNumberKo(Number(n))} ${c}`;
};

/** "2027-01-05" → "2027.01.05" · 날짜가 아니면 원문 */
const fmtDateKo = (v: string | null | undefined): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  const ym = /^(\d{4})-(\d{2})$/.exec(s);
  if (ym) return `${ym[1]}.${ym[2]}`;
  return s;
};

const fmtRangeKo = (a: string | null | undefined, b: string | null | undefined): string | null => {
  const x = fmtDateKo(a);
  const y = fmtDateKo(b);
  if (x && y) return x === y ? x : `${x} ~ ${y}`;
  return x ?? y ?? null;
};

const HOLDER_KO: Record<string, string> = { self: "본인", parent: "부모", guardian: "보호자", financial_sponsor: "재정보증인" };

const financialKo: BrochureText["financial"] = (f) => {
  if (!f || f.amount == null) return null;
  const parts = [`최소 잔고 ${fmtMoneyKo(f.amount, f.currency || "USD")}`];
  const holders = (f.holder_relations ?? []).map((h) => HOLDER_KO[h]).filter(Boolean);
  if (holders.length) parts.push(`${holders.join(" / ")} 명의`);
  if (f.freshness_days) parts.push(`${f.freshness_days}일 이내 발급`);
  return parts.join(", ");
};

const pctKo = (v: number | string): string => {
  const n = typeof v === "number" ? v : Number(String(v).replace(/[%\s]/g, ""));
  if (!Number.isFinite(n)) return String(v);
  return `${n > 0 && n <= 1 ? Math.round(n * 1000) / 10 : n}%`;
};

const scholarshipBenefitKo: BrochureText["scholarshipBenefit"] = (s) => {
  const v = s.benefit_value;
  const has = v != null && String(v).trim() !== "";
  const money = (x: number | string) => (typeof x === "number" ? fmtMoneyKo(x) : x);
  if (s.tiered_by_topik && Object.keys(s.tiered_by_topik).length) {
    const tiers = Object.entries(s.tiered_by_topik)
      .filter(([, x]) => x != null && String(x).trim() !== "" && Number(x) !== 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lv, x]) => `TOPIK ${lv}급: ${s.benefit_type === "tuition_amount" ? money(x) : pctKo(x)}`);
    if (tiers.length) return `TOPIK 급수별 등록금 감면 — ${tiers.join(" · ")}`;
  }
  switch (s.benefit_type) {
    case "tuition_pct":
      return has ? `등록금 ${pctKo(v!)} 감면` : "등록금 감면";
    case "tuition_amount":
      return has ? `등록금 ${money(v!)} 감면` : "등록금 감면";
    case "admission_fee_waiver":
      return "입학금 면제";
    case "stipend":
      return has ? `생활비 ${money(v!)} 지원` : "생활비 지원";
    case "dorm":
      return has ? `기숙사비 ${money(v!)} 지원` : "기숙사 지원";
    default:
      return has ? (typeof v === "number" ? fmtMoneyKo(v) : String(v)) : null;
  }
};

const KO: BrochureText = {
  lang: "ko",
  intro:
    "글로케어는 삼성생명에서 출발한 기업으로, 한국 산업에 필요한 글로벌 인재를 양성하고 연결합니다. 유학생 선발부터 진로 설계까지 함께합니다.",
  L: {
    eyebrow: "유학생 모집요강",
    brand: "GLOCARE",
    brandSub: "한국 유학",
    quota: (n) => `모집 인원: ${n}명`,
    quotaLabel: "모집 인원",
    quotaUnit: "명",
    courseLanguage: "어학연수 과정 (D-4)",
    courseRegular: "정규 과정 (D-2)",
    years: (n) => `수업 연한: ${n}년`,
    region: "지역",

    secEligibility: "지원 자격",
    secTuition: "학비·장학금",
    secSchedule: "모집 일정",
    secCareer: "졸업 후 진로",
    secStrengths: "학교 강점",
    secDocuments: "제출 서류",

    education: "학력",
    gpa: "성적(GPA)",
    age: "나이",
    korean: "한국어 능력",
    koreanAlt: "대체 인정",
    english: "영어 능력",
    financial: "재정 증명",
    preferences: "우대 사항",
    program: "프로그램",

    tuitionTitle: "학비",
    scholarshipTitle: "장학금",
    dormitoryTitle: "기숙사",
    tuitionPending: "학비는 합격 후 안내합니다.",
    free: "면제",

    scheduleFootnote: "※ 모집 인원과 일정은 학교 사정에 따라 변경될 수 있습니다.",
    schoolForms: "학교 양식",
    optional: "(선택)",
    or: "또는",
    empty: "등록된 정보가 없습니다.",
  },
  education: {
    high_school: "고등학교 졸업",
    high_school_12yrs: "12년 정규 교육",
    health_related_bachelor: "보건계열 학사",
    bachelor: "학사",
    master: "석사",
  },
  altPath: {
    sejong_institute: "세종학당",
    kiip: "사회통합프로그램(KIIP)",
    university_internal_test: "교내 한국어 시험",
    korean_education_center: "한국교육원",
    health_science_degree: "보건의료 학위",
    elder_care_career: "요양보호 경력",
  },
  tuitionUnit: { per_semester: "학기당 학비", per_year: "연간 학비", per_program: "전체 과정 학비" },
  fee: {
    application_fee: "전형료",
    admission_fee: "입학금",
    dorm_fee: "기숙사비",
    insurance_per_year: "보험료(연간)",
    payment_method: "납부 방법",
  },
  appliesTo: { freshman: "신입생", enrolled: "재학생", both: "신입생·재학생" },
  schedule: {
    application: "원서 접수",
    documents: "서류 제출 마감",
    interview: "면접",
    result: "합격자 발표",
    payment: "등록금 납부",
    visa: "표준입학허가서 발급",
    enrollment: "등록",
    enrollmentExtra: "추가 등록",
    orientation: "오리엔테이션",
    semesterStart: "개강",
    semesterEnd: "학기 종료",
    submission: "제출 방법",
    round: (n) => `${n}차`,
    singleRound: "모집 일정",
  },
  target: { father: "부", mother: "모", sponsor: "재정보증인", other: "기타" },
  docCond: {
    issuedWithin: (n) => `발급 ${n}일 이내`,
    validity: (n) => `유효기간 ${n}일`,
    original: "원본 제출",
  },
  lp: {
    hoursPerWeek: (n) => `주 ${n}시간`,
    hoursPerSemester: (n) => `학기당 ${n}시간`,
    weeks: (n) => `학기당 ${n}주`,
    schedule: "수업 시간",
    visa: "비자",
    visaExtension: "비자 연장",
  },
  termLabel: termLabelKo,
  fmtDate: fmtDateKo,
  fmtMoney: fmtMoneyKo,
  fmtRange: fmtRangeKo,
  age: formatAgeRequirement,
  gpa: (min, scale) => (min == null ? null : scale ? `최소 ${min}/${scale}` : `최소 ${min}`),
  topik: (level) => (level ? `TOPIK ${level}급 이상` : null),
  financial: financialKo,
  scholarshipBenefit: scholarshipBenefitKo,
  roundName: (name, index, total) => {
    const s = String(name ?? "").trim();
    if (s) return s;
    return total > 1 ? `${index + 1}차` : "모집 일정";
  },
};

export function brochureText(lang: BrochureLang): BrochureText {
  return lang === "ko" ? KO : VI;
}
