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
