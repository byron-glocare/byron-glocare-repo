/**
 * 유학비자 발급조건 룰 엔진 (TypeScript 포트).
 *
 * docs/visa requirement/rules.json 을 단일 진실원본으로 삼는다.
 * 매칭 규칙은 test_rules.py 의 cond/derive/matches/resolve 와 동일해야 한다.
 */
import rulesData from "./rules.json";

export type Ctx = Record<string, string | null | undefined>;

export interface AxisOption {
  value: string;
  label: string;
}
export interface Axis {
  id: string;
  label: string;
  required?: boolean;
  options: AxisOption[];
}
export interface Rule {
  id: string;
  group: string;
  kind: "blocker" | "caution" | "info" | "requirement" | "verify" | "doc";
  title: string;
  body: string;
  when?: Record<string, string[]>;
  whenNot?: Record<string, string[]>;
  confidence: "confirmed" | "inferred" | "conflict" | "unknown";
  sources?: string[];
  note?: string;
  value?: Record<string, unknown>;
}
export interface Group {
  label: string;
  order: number;
  gate: string;
}
export interface Source {
  issuer: string;
  title: string;
  asOf?: string;
  reliability?: string;
  note?: string;
  docAsOf?: string;
  lastVerified?: string;
}
export interface DerivedAxis {
  label: string;
  desc?: string;
  default: string;
  values: Record<string, string>;
  cases: { if: Record<string, string[]>; then: string; why?: string }[];
}
export interface RuleSet {
  meta: {
    name: string;
    version: string;
    compiledAt: string;
    scope: string;
    warning: string;
  };
  confidenceLevels: Record<string, { label: string; desc: string }>;
  sources: Record<string, Source>;
  axes: Axis[];
  groups: Record<string, Group>;
  rules: Rule[];
  derivedAxes: Record<string, DerivedAxis>;
  checks: unknown[];
}

export const D = rulesData as unknown as RuleSet;

/** 조건 c 의 모든 키가 ctx 에서 허용값 집합에 속하면 참. */
function cond(c: Record<string, string[]>, ctx: Ctx): boolean {
  return Object.entries(c).every(([k, vals]) => {
    const v = ctx[k];
    return v != null && vals.includes(v);
  });
}

/** 파생 축 계산 (first match wins). */
export function derive(input: Ctx): Ctx {
  const ctx: Ctx = { ...input };
  for (const [key, spec] of Object.entries(D.derivedAxes)) {
    let val = spec.default;
    for (const c of spec.cases) {
      if (cond(c.if, ctx)) {
        val = c.then;
        break;
      }
    }
    ctx[key] = val;
  }
  return ctx;
}

function matches(rule: Rule, ctx: Ctx): boolean {
  if (!cond(rule.when ?? {}, ctx)) return false;
  for (const [k, vals] of Object.entries(rule.whenNot ?? {})) {
    const v = ctx[k];
    if (v != null && vals.includes(v)) return false;
  }
  return true;
}

export interface ResolveResult {
  ctx: Ctx;
  rules: Rule[];
}

/** 입력 → 파생 계산 → 적용 조항 목록. */
export function resolve(input: Ctx): ResolveResult {
  const ctx = derive(input);
  const rules = D.rules.filter((r) => matches(r, ctx));
  return { ctx, rules };
}

/* ============================================================================
 * v2 조회 어댑터 — 4개 입력 축 + 옵션축 태그화
 * ==========================================================================*/
export type UnivRegion = "metro" | "nonmetro";
export type UnivTier =
  | "excellent"
  | "certified"
  | "general"
  | "consulting"
  | "restricted";

/** 사용자가 상단에서 직접 고르는 축(4개 입력이 매핑되는 하위 엔진축). */
export const QUERY_AXES = [
  "track",
  "nationality",
  "applicantRegion",
  "univTier",
  "univRegion",
  "statusCode",
] as const;

/** 입력받지 않고 결과에서 옵션 태그로만 노출되는 축. */
export const OPTION_AXES = [
  "scholarship",
  "sponsor",
  "parentJob",
  "stayMonths",
  "gradCert",
  "langTrack",
  "balanceCurrency",
] as const;

/** 병합 입력 '국적 및 거주지' 옵션 → {nationality, applicantRegion} 매핑. */
export const ORIGIN_OPTIONS: { value: string; label: string; ctx: Ctx }[] = [
  { value: "vn_north", label: "베트남 — 북부 (하노이 대사관 관할)", ctx: { nationality: "vn", applicantRegion: "vn_north" } },
  { value: "vn_south", label: "베트남 — 남부 (호치민 총영사관 관할)", ctx: { nationality: "vn", applicantRegion: "vn_south" } },
  { value: "cn", label: "중국", ctx: { nationality: "cn", applicantRegion: null } },
  { value: "mn", label: "몽골", ctx: { nationality: "mn", applicantRegion: null } },
  { value: "uz", label: "우즈베키스탄", ctx: { nationality: "uz", applicantRegion: null } },
  { value: "notified_other", label: "기타 법무부 고시국가 (21개국)", ctx: { nationality: "notified_other", applicantRegion: null } },
  { value: "general", label: "일반 국가 (그 외)", ctx: { nationality: "general", applicantRegion: null } },
];

/** 축 값 → 한글 라벨 조회 (D.axes 기반). */
const AXIS_OPT_LABEL: Record<string, Record<string, string>> = Object.fromEntries(
  D.axes.map((a) => [a.id, Object.fromEntries(a.options.map((o) => [o.value, o.label]))])
);
const AXIS_LABEL: Record<string, string> = Object.fromEntries(
  D.axes.map((a) => [a.id, a.label])
);
AXIS_LABEL.finProof = "재정입증";

export function axisLabel(axis: string): string {
  return AXIS_LABEL[axis] ?? axis;
}
export function valueLabel(axis: string, value: string): string {
  if (axis === "finProof") return D.derivedAxes.finProof.values[value] ?? value;
  return AXIS_OPT_LABEL[axis]?.[value] ?? value;
}

/** 신청할 비자(statusCode) 옵션 — 강조 대상(D-4-1/D-2-1/D-2-2) 표시. */
export const EMPHASIZED_STATUS = new Set(["D-4-1", "D-2-1", "D-2-2"]);

export interface QueryInput {
  track: string;
  nationality: string;
  applicantRegion: string | null;
  univTier: UnivTier;
  univRegion: UnivRegion;
  statusCode: string;
}

/** 4개 입력 고정 시, 장학금 도메인을 훑어 finProof 가 가질 수 있는 값들. */
function achievableFinProof(base: Ctx): Set<string> {
  const s = new Set<string>();
  for (const sch of ["none", "partial", "full", "gks"]) {
    s.add(derive({ ...base, scholarship: sch }).finProof as string);
  }
  return s;
}

const isQuery = (k: string) => (QUERY_AXES as readonly string[]).includes(k);

export interface OptionTag {
  axis: string;
  values: string[];
  negate?: boolean;
}

/** 조항이 이 입력에서 적용 후보인지 + 이 조항을 가르는 옵션 조건(태그). */
function evaluate(
  rule: Rule,
  base: Ctx,
  fin: Set<string>
): { candidate: boolean; tags: OptionTag[] } {
  const tags: OptionTag[] = [];
  for (const [k, vals] of Object.entries(rule.when ?? {})) {
    if (isQuery(k)) {
      if (base[k] == null || !vals.includes(base[k] as string)) return { candidate: false, tags: [] };
    } else if (k === "finProof") {
      if (!vals.some((v) => fin.has(v))) return { candidate: false, tags: [] };
      // finProof 가 여러 값을 가질 수 있을 때만 조건으로 노출
      if (fin.size > 1) tags.push({ axis: k, values: vals });
    } else {
      tags.push({ axis: k, values: vals });
    }
  }
  for (const [k, vals] of Object.entries(rule.whenNot ?? {})) {
    if (isQuery(k)) {
      if (base[k] != null && vals.includes(base[k] as string)) return { candidate: false, tags: [] };
    } else if (k === "finProof") {
      if (vals.every((v) => fin.has(v)) && fin.size === vals.length) return { candidate: false, tags: [] };
    } else {
      tags.push({ axis: k, values: vals, negate: true });
    }
  }
  return { candidate: true, tags };
}

export interface Candidate {
  rule: Rule;
  tags: OptionTag[];
}

/** v2 조회: 4개 입력 → 적용 후보 조항 + 옵션태그. */
export function lookup(input: QueryInput): { finProof: Set<string>; candidates: Candidate[] } {
  const base: Ctx = {
    track: input.track,
    nationality: input.nationality,
    applicantRegion: input.applicantRegion,
    univTier: input.univTier,
    univRegion: input.univRegion,
    statusCode: input.statusCode,
  };
  const fin = achievableFinProof(base);
  const candidates: Candidate[] = [];
  for (const rule of D.rules) {
    const { candidate, tags } = evaluate(rule, base, fin);
    if (candidate) candidates.push({ rule, tags });
  }
  return { finProof: fin, candidates };
}
