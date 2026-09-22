/**
 * 서류 추출값 ↔ 정보입력 현재값 비교 도우미 (서버 페이지·서버 액션 공용, 순수 함수).
 *   "use server" 파일은 async 함수만 export 할 수 있어서 여기로 분리했다.
 */

import type { Json } from "@/types/database";

export type Confidence = "high" | "medium" | "low";

/** study_student_doc_extractions.proposals 의 원소 */
export type StoredDocProposal = {
  key: string;
  value: Json;
  display: string;
  confidence: Confidence;
  source: string | null;
};

/** 정보입력 화면에 넘기는 "서류와 다름" 제안 1건 */
export type DocSuggestion = {
  extractionId: string;
  fileName: string;
  display: string;
  value: Json;
  confidence: Confidence;
};

export const CONF_RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

export function isEmptyValue(v: Json | null | undefined): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0)
  );
}

/** 비교용 정규화 — 공백·대소문자·천 단위 쉼표·날짜 0 채움 차이는 무시 */
export function canonValue(v: Json | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => canonValue(x as Json)).sort().join("|");
  if (typeof v === "number") return String(v);
  const s = String(v).trim().toLowerCase().replace(/\s+/g, " ");
  const d = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s);
  if (d) return `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}`;
  if (/^-?[\d,]+(\.\d+)?$/.test(s)) {
    const n = Number(s.replace(/,/g, ""));
    if (Number.isFinite(n)) return String(n);
  }
  return s;
}

/** 두 값이 사실상 같은가 */
export function sameValue(a: Json | null | undefined, b: Json | null | undefined): boolean {
  return canonValue(a) === canonValue(b);
}

/** DB jsonb(proposals) → 형식이 맞는 제안만 */
export function parseStoredProposals(raw: unknown): StoredDocProposal[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredDocProposal[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.key !== "string") continue;
    const confidence: Confidence =
      o.confidence === "high" || o.confidence === "medium" || o.confidence === "low"
        ? o.confidence
        : "medium";
    const value = (o.value ?? null) as Json;
    if (isEmptyValue(value)) continue;
    out.push({
      key: o.key,
      value,
      display: typeof o.display === "string" ? o.display : String(value),
      confidence,
      source: typeof o.source === "string" ? o.source : null,
    });
  }
  return out;
}

/** 추출 기록 1행 (done) — 비교 계산에 필요한 부분만 */
export type ExtractionRowLite = {
  id: string;
  file_name: string | null;
  proposals: unknown;
  dismissed_keys: string[] | null;
  extracted_at: string;
};

/**
 * 항목별 "서류와 다름" 제안 계산.
 *   현재값과 (정규화 후) 다르고, 그 추출 행에서 무시하지 않은 제안만.
 *   같은 값을 여러 서류가 제안하면 한 번만(신뢰도 높은 것, 그다음 최신).
 */
export function computeDocSuggestions(
  rows: ExtractionRowLite[],
  currentByKey: Map<string, Json | null>,
  allowedKeys?: Set<string>
): Record<string, DocSuggestion[]> {
  const sorted = [...rows].sort((a, b) => b.extracted_at.localeCompare(a.extracted_at));
  const byKey = new Map<string, DocSuggestion[]>();
  for (const row of sorted) {
    const dismissed = new Set(row.dismissed_keys ?? []);
    for (const p of parseStoredProposals(row.proposals)) {
      if (allowedKeys && !allowedKeys.has(p.key)) continue;
      if (dismissed.has(p.key)) continue;
      if (sameValue(currentByKey.get(p.key) ?? null, p.value)) continue;
      const list = byKey.get(p.key) ?? [];
      const dup = list.findIndex((s) => sameValue(s.value, p.value));
      const sug: DocSuggestion = {
        extractionId: row.id,
        fileName: row.file_name ?? "",
        display: p.display,
        value: p.value,
        confidence: p.confidence,
      };
      if (dup >= 0) {
        if (CONF_RANK[p.confidence] < CONF_RANK[list[dup].confidence]) list[dup] = sug;
      } else {
        list.push(sug);
      }
      byKey.set(p.key, list);
    }
  }
  const out: Record<string, DocSuggestion[]> = {};
  for (const [k, list] of byKey) {
    out[k] = list.sort((a, b) => CONF_RANK[a.confidence] - CONF_RANK[b.confidence]);
  }
  return out;
}

/** select 값 → 한국어 라벨 (표시용) */
export function displayValue(
  v: Json | null | undefined,
  options: Array<{ value: string; label_ko: string }> | null
): string {
  if (v === null || v === undefined) return "";
  const labelFor = (value: string) =>
    options?.find((o) => o.value === value)?.label_ko ?? value;
  if (Array.isArray(v)) return v.map((x) => labelFor(String(x))).join(", ");
  return labelFor(String(v));
}
