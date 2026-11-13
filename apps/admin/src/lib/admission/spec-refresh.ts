/**
 * 모집요강 "원본으로 갱신" — 저장된 원본을 다시 추출한 값과 지금 입력값을 항목별로 비교한다.
 *   순수 함수만(서버·클라이언트 공용). 적용은 사람이 고른 항목만 — 기본은 아무것도 고르지 않는다.
 *
 *   원칙
 *   - 원본에서 값이 안 나온 항목은 비교하지 않는다(갱신으로 지우지 않는다).
 *   - 같은 값은 보여주지 않는다.
 *   - 지금 값이 더 자세해 보이면(목록 개수·글 길이·채운 칸 수) "주의"를 단다 — 수기 보완을 덮어쓰지 않게.
 */

import { normDeptName } from "./spec-merge";

export type RefreshTarget =
  | { kind: "dept"; sdId: string; column: "tuition" | "scholarships" | "eligibility" | "info" }
  | { kind: "term"; termId: string; column: "schedule" | "schedule_language" };

export type RefreshItem = {
  id: string;
  group: string;
  label: string;
  target: RefreshTarget;
  /** 그 열(JSON) 안의 키 — 빈 배열이면 열 전체 */
  path: string[];
  current: unknown;
  proposed: unknown;
  /** 지금 값이 비어 있음 → 채우기만 하는 변경 */
  fillsEmpty: boolean;
  caution: string | null;
};

export type RefreshChange = { target: RefreshTarget; path: string[]; value: unknown };

export type RefreshDept = {
  id: string;
  kind: "language" | "regular";
  name_ko: string;
  info: Record<string, unknown>;
  tuition: Record<string, unknown>;
  scholarships: unknown[];
  eligibility: Record<string, unknown> | null;
};
export type RefreshTerm = { id: string; term: string; schedule: Record<string, unknown>; schedule_language: Record<string, unknown> };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** 비교용 정리 — null·undefined·빈 글·빈 목록·빈 객체 키는 없는 것으로 */
export function normalize(v: unknown, sortKeys = true): unknown {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() === "" ? undefined : v.trim();
  if (Array.isArray(v)) {
    const a = v.map((x) => normalize(x, sortKeys)).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (isObj(v)) {
    const o: Obj = {};
    for (const k of sortKeys ? Object.keys(v).sort() : Object.keys(v)) {
      const x = normalize(v[k], sortKeys);
      if (x !== undefined) o[k] = x;
    }
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}

export const isEmptyValue = (v: unknown): boolean => normalize(v) === undefined;
const same = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

/** 채운 값(잎) 개수 */
function leafCount(v: unknown): number {
  const n = normalize(v);
  if (n === undefined) return 0;
  if (Array.isArray(n)) return n.reduce((s: number, x) => s + leafCount(x), 0);
  if (isObj(n)) return Object.values(n).reduce((s: number, x) => s + leafCount(x), 0);
  return 1;
}

function cautionOf(current: unknown, proposed: unknown): string | null {
  if (isEmptyValue(current)) return null;
  const c = normalize(current);
  const p = normalize(proposed);
  if (Array.isArray(c) && Array.isArray(p) && c.length > p.length) {
    return `지금 ${c.length}개 → 원본 ${p.length}개. 수기로 나눠 입력했을 수 있습니다.`;
  }
  if ((isObj(c) || Array.isArray(c)) && leafCount(c) > leafCount(p)) return "지금 입력이 더 자세합니다.";
  if (typeof c === "string" && typeof p === "string" && c.length > p.length) return "지금 글이 더 깁니다.";
  return null;
}

type Field = { key: string; label: string };
const TUITION_FIELDS: Field[] = [
  { key: "tuition_per_semester", label: "학기당 학비" },
  { key: "tuition_per_year", label: "연간 학비" },
  { key: "unit", label: "학비 단위" },
  { key: "disclosure_state", label: "학비 공개 여부" },
  { key: "currency", label: "통화" },
  { key: "application_fee", label: "전형료" },
  { key: "admission_fee", label: "입학금" },
  { key: "dorm_fee", label: "기숙사비" },
  { key: "insurance_per_year", label: "보험료(연간)" },
  { key: "tuition_by_faculty", label: "계열별 학비" },
  { key: "other_fees", label: "기타 비용" },
  { key: "payment_method", label: "납부 방법" },
  { key: "refund_policy", label: "환불 규정" },
  { key: "notes", label: "학비 메모" },
];
const ELIG_FIELDS: Field[] = [
  { key: "education_required", label: "학력" },
  { key: "education_paths", label: "인정 학력" },
  { key: "education_exclusions", label: "학력 제외" },
  { key: "gpa_min", label: "최저 성적" },
  { key: "gpa_scale", label: "성적 만점" },
  { key: "age_requirement", label: "나이" },
  { key: "korean_proficiency", label: "한국어 능력" },
  { key: "english_proficiency", label: "영어 능력" },
  { key: "financial_minimum", label: "재정 능력" },
  { key: "applicant_categories", label: "지원 대상" },
  { key: "exclusions", label: "지원 제외" },
  { key: "notes_ko", label: "자격 메모" },
];
const INFO_FIELDS: Field[] = [
  { key: "faculty", label: "계열" },
  { key: "track", label: "트랙" },
  { key: "degree", label: "학위" },
  { key: "years", label: "수업 연한" },
  { key: "capacity", label: "모집 인원" },
  { key: "korean_min_topik", label: "최저 TOPIK" },
  { key: "tuition_per_semester_krw", label: "학기당 학비(학과)" },
  { key: "notes", label: "학과 메모" },
];
const LANGUAGE_PROGRAM_FIELDS: Field[] = [
  { key: "hours_per_week", label: "주당 수업 시간" },
  { key: "hours_per_semester", label: "학기당 수업 시간" },
  { key: "weeks_per_semester", label: "학기당 주 수" },
  { key: "weekly_schedule", label: "수업 시간" },
  { key: "visa_type", label: "비자" },
  { key: "visa_extension", label: "비자 연장" },
];
const SCHEDULE_FIELDS: Field[] = [
  { key: "rounds", label: "모집 회차(접수·면접·발표)" },
  { key: "main_enrollment_period", label: "등록 기간" },
  { key: "additional_enrollment_period", label: "추가 등록 기간" },
  { key: "orientation", label: "오리엔테이션" },
  { key: "semester_start", label: "개강일" },
  { key: "semester_end", label: "학기 종료일" },
  { key: "submission_method", label: "제출 방법" },
];

/** 원본 추출의 학과 정보 중 이 학과에 해당하는 것 */
function extractedInfoFor(dept: RefreshDept, spec: Obj): Obj | null {
  const list = (Array.isArray(spec.departments) ? spec.departments : []).filter(isObj);
  if (dept.kind === "language") return list[0] ?? null;
  const byName = list.find((d) => normDeptName(String(d.name ?? "")) === normDeptName(dept.name_ko));
  if (byName) return byName;
  return list.length === 1 ? list[0] : null;
}

export function buildRefreshItems(input: {
  extracted: Obj;
  dept: RefreshDept;
  term: RefreshTerm | null;
  specEligibility: Obj | null;
}): RefreshItem[] {
  const { extracted, dept, term } = input;
  const items: RefreshItem[] = [];
  const push = (group: string, f: Field, target: RefreshTarget, path: string[], current: unknown, proposed: unknown) => {
    if (isEmptyValue(proposed) || same(current, proposed)) return;
    items.push({
      id: `${group}|${path.join(".") || target.column}`,
      group,
      label: f.label,
      target,
      path,
      current,
      proposed,
      fillsEmpty: isEmptyValue(current),
      caution: cautionOf(current, proposed),
    });
  };

  // 학과 정보
  const info = extractedInfoFor(dept, extracted);
  const infoTarget: RefreshTarget = { kind: "dept", sdId: dept.id, column: "info" };
  if (info) for (const f of INFO_FIELDS) push("학과 정보", f, infoTarget, [f.key], dept.info[f.key], info[f.key]);
  if (dept.kind === "language") {
    const meta = isObj(extracted.metadata) ? extracted.metadata : {};
    const lp = isObj(meta.language_program) ? meta.language_program : {};
    const curLp = isObj(dept.info.language_program) ? dept.info.language_program : {};
    for (const f of LANGUAGE_PROGRAM_FIELDS) push("어학연수 프로그램", f, infoTarget, ["language_program", f.key], curLp[f.key], lp[f.key]);
  }

  // 자격 — 학과에 따로 없으면 요강 공통 자격을 지금 값으로 본다(적용하면 학과 자격으로 저장)
  const elig = isObj(extracted.eligibility) ? extracted.eligibility : {};
  const curElig = (isObj(dept.eligibility) && Object.keys(dept.eligibility).length ? dept.eligibility : input.specEligibility) ?? {};
  const eligTarget: RefreshTarget = { kind: "dept", sdId: dept.id, column: "eligibility" };
  for (const f of ELIG_FIELDS) push("지원 자격", f, eligTarget, [f.key], curElig[f.key], elig[f.key]);

  // 학비
  const tuition = isObj(extracted.tuition) ? extracted.tuition : {};
  const tuitionTarget: RefreshTarget = { kind: "dept", sdId: dept.id, column: "tuition" };
  for (const f of TUITION_FIELDS) push("학비", f, tuitionTarget, [f.key], dept.tuition[f.key], tuition[f.key]);

  // 장학금 — 목록 통째
  push("장학금", { key: "scholarships", label: "장학금 목록" }, { kind: "dept", sdId: dept.id, column: "scholarships" }, [], dept.scholarships, extracted.scholarships);

  // 일정 — 고른 학기, 학과 종류에 맞는 일정
  if (term) {
    const column = dept.kind === "language" ? "schedule_language" : "schedule";
    const sched = isObj(extracted.schedule) ? extracted.schedule : {};
    const cur = term[column] ?? {};
    for (const f of SCHEDULE_FIELDS) push("모집 일정", f, { kind: "term", termId: term.id, column }, [f.key], cur[f.key], sched[f.key]);
  }
  return items;
}

/** JSON 열 안의 경로에 값 넣기 (원본은 그대로, 새 객체를 돌려준다) */
export function setAtPath(base: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;
  const o: Obj = isObj(base) ? { ...base } : {};
  const [k, ...rest] = path;
  o[k] = setAtPath(o[k], rest, value);
  return o;
}

// ── 화면 표시 ─────────────────────────────────────────────────────────

const KEY_LABEL: Record<string, string> = {
  name: "이름", condition: "조건", benefit_type: "혜택", benefit_value: "혜택 값", tiered_by_topik: "TOPIK별",
  applies_to: "대상", duration: "기간", notes: "메모", amount: "금액", currency: "통화",
  min_age: "최소 나이", max_age: "최대 나이", birth_date_from: "출생 이후", birth_date_to: "출생 이전", reference_date: "기준일",
  topik_min_default: "최저 TOPIK", alternative_paths: "대체 인정", type: "종류", level: "수준",
  holder_relations: "명의", freshness_days: "발급 기한(일)", minimums: "최저 점수",
  application_open: "접수 시작", application_close: "접수 마감", document_submission_close: "서류 마감",
  interview: "면접", interview_period: "면접 기간", result_announcement: "발표", payment_period: "납부 기간",
  visa_certificate_issuance: "입학허가서 발급",
};

/** 코드값 → 한국어 (모르는 값은 그대로) */
const VALUE_LABEL: Record<string, string> = {
  freshman: "신입생", enrolled: "재학생", both: "신입생·재학생",
  tuition_pct: "등록금 % 감면", tuition_amount: "등록금 정액 감면", admission_fee_waiver: "입학금 면제",
  stipend: "생활비 지원", dorm: "기숙사 지원", policy: "정책 혜택", other: "기타",
  per_semester: "학기당", per_year: "연간", per_program: "전체 과정", pending: "합격 후 안내",
  disclosed: "공개", pending_until_acceptance: "합격 후 공개",
  high_school: "고등학교 졸업", high_school_12yrs: "12년 정규 교육", health_related_bachelor: "보건계열 학사", bachelor: "학사", master: "석사",
  self: "본인", parent: "부모", guardian: "보호자", financial_sponsor: "재정보증인",
  sejong_institute: "세종학당", kiip: "사회통합프로그램(KIIP)", university_internal_test: "교내 한국어 시험",
  korean_education_center: "한국교육원", health_science_degree: "보건의료 학위", elder_care_career: "요양보호 경력",
};
function valueLabel(v: unknown): string {
  if (typeof v === "number") return v.toLocaleString("ko-KR");
  if (typeof v === "boolean") return v ? "예" : "아니오";
  const s = String(v);
  return VALUE_LABEL[s] ?? s;
}

/** 값 → 여러 줄 글 (목록·객체는 펼친다) */
export function displayLines(v: unknown, indent = ""): string[] {
  const n = normalize(v, false);
  if (n === undefined) return [`${indent}(비어 있음)`];
  if (Array.isArray(n)) {
    if (n.every((x) => !isObj(x) && !Array.isArray(x))) return [`${indent}${n.map(valueLabel).join(" ~ ")}`];
    return n.flatMap((x, i) => {
      const lines = displayLines(x, `${indent}  `);
      return [`${indent}${i + 1}.`, ...lines];
    });
  }
  if (isObj(n)) {
    return Object.entries(n).flatMap(([k, x]) => {
      const label = KEY_LABEL[k] ?? k;
      const inner = displayLines(x, `${indent}  `);
      if (inner.length === 1) return [`${indent}${label}: ${inner[0].trim()}`];
      return [`${indent}${label}:`, ...inner];
    });
  }
  return [`${indent}${valueLabel(n)}`];
}
