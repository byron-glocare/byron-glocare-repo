/**
 * 모집요강 ↔ 서류 항목 (study_spec_doc_items) — 전환기 공용 로직.
 *
 *   정본은 study_spec_doc_items(요강이 고른 항목 + 필수/안내문/조건 덮어쓰기)다.
 *   옛 required_documents JSONB 는 abroad(학생·센터 화면)가 아직 읽으므로, 항목이 바뀔 때마다
 *   **발급서류 줄만** 항목에서 다시 그려 채운다. 작성서류 줄과 미연결 줄(std_key 없음)은
 *   JSONB 에 그대로 둔다 — 작성서류는 작성서류 탭 몫이고, 미연결은 연결 UI 가 붙인다.
 *
 *   반대 방향(JSONB → 행)은 AI 추출·승인·복제처럼 JSONB 가 먼저 생기는 곳에서 쓴다.
 *   0060 의 변환 규칙과 같다: std_key 있는 발급서류 → item_<서류키>[__대상자].
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { isFormDoc, type RequiredDoc } from "./classify-documents";
import { loadFormDocKeys } from "./form-doc-keys";

type Client = SupabaseClient<Database>;

export type DocOption = { standard?: string; item?: string };
export type DocSlot = { target: string | null; required?: boolean; options: DocOption[] };
export type DocVariant = { when: { nationality?: string } | null; slots: DocSlot[] };

export type CatalogItem = {
  key: string;
  name_ko: string;
  name_vi: string | null;
  guide_ko: string | null;
  guide_vi: string | null;
  variants: DocVariant[];
  is_active: boolean;
};
export type CatalogStandard = {
  key: string;
  name_ko: string;
  name_vi: string | null;
  issuer_ko: string | null;
  validity_days: number | null;
  notarization: string | null;
  original_required: boolean | null;
  issued_within_days: number | null;
  guide_ko: string | null;
  guide_vi: string | null;
  is_active: boolean;
};
export type DocCatalog = { items: CatalogItem[]; standards: CatalogStandard[] };

/** 조건 덮어쓰기 — 서류별. 표준과 다른 값만 넣는다. */
export type StandardOverride = {
  validity_days?: number | null;
  notarization?: string | null;
  original_required?: boolean | null;
  issued_within_days?: number | null;
};
export type SpecDocOverrides = { standards?: Record<string, StandardOverride> };

export type SpecDocItemRow = {
  item_key: string;
  required: boolean;
  sort_order: number;
  guide_override_ko: string | null;
  guide_override_vi: string | null;
  overrides: SpecDocOverrides;
};

export type LegacyDoc = RequiredDoc & Record<string, unknown>;

const BASE_NATIONALITY = "vn";
export const TARGET_LABEL_KO: Record<string, string> = { self: "본인", father: "아버지", mother: "어머니", sponsor: "재정보증인", other: "기타" };

// ── 카탈로그 ──────────────────────────────────────────────────────────

export async function loadDocCatalog(supabase: Client): Promise<DocCatalog> {
  const [{ data: items }, { data: standards }] = await Promise.all([
    supabase.from("study_doc_items").select("key, name_ko, name_vi, guide_ko, guide_vi, variants, is_active").order("sort_order").order("name_ko"),
    supabase
      .from("study_doc_standards")
      .select("key, name_ko, name_vi, issuer_ko, validity_days, notarization, original_required, issued_within_days, guide_ko, guide_vi, is_active, is_form_doc")
      .eq("is_form_doc", false)
      .order("sort_order")
      .order("name_ko"),
  ]);
  return {
    items: (items ?? []).map((i) => ({
      key: i.key, name_ko: i.name_ko, name_vi: i.name_vi, guide_ko: i.guide_ko, guide_vi: i.guide_vi,
      variants: (Array.isArray(i.variants) ? i.variants : []) as DocVariant[], is_active: i.is_active,
    })),
    standards: (standards ?? []).map((s) => ({
      key: s.key, name_ko: s.name_ko, name_vi: s.name_vi, issuer_ko: s.issuer_ko, validity_days: s.validity_days,
      notarization: s.notarization, original_required: s.original_required, issued_within_days: s.issued_within_days,
      guide_ko: s.guide_ko, guide_vi: s.guide_vi, is_active: s.is_active,
    })),
  };
}

export async function loadSpecDocItemRows(supabase: Client, specId: string): Promise<SpecDocItemRow[]> {
  const { data } = await supabase
    .from("study_spec_doc_items")
    .select("item_key, required, sort_order, guide_override_ko, guide_override_vi, overrides")
    .eq("spec_id", specId)
    .order("sort_order");
  return (data ?? []).map((r) => ({
    item_key: r.item_key,
    required: r.required,
    sort_order: r.sort_order,
    guide_override_ko: r.guide_override_ko,
    guide_override_vi: r.guide_override_vi,
    overrides: ((r.overrides ?? {}) as SpecDocOverrides) ?? {},
  }));
}

/** 항목의 베트남 기준 구성 (옛 데이터 when=null 도 베트남) */
export function baseVariantOf(item: CatalogItem): DocVariant | null {
  const vs = item.variants ?? [];
  return vs.find((v) => ((v.when?.nationality ?? "").trim() || BASE_NATIONALITY) === BASE_NATIONALITY) ?? vs[0] ?? null;
}

/** 한 항목이 실제로 요구하는 서류 줄 — 베트남 기준, 다른 항목은 한 단계만 펼친다 */
export type ExpandedSlot = { standard: CatalogStandard; target: string | null; required: boolean; alternatives: CatalogStandard[] };
export function expandItem(item: CatalogItem, catalog: DocCatalog, depth = 0): ExpandedSlot[] {
  const stdByKey = new Map(catalog.standards.map((s) => [s.key, s]));
  const itemByKey = new Map(catalog.items.map((i) => [i.key, i]));
  const base = baseVariantOf(item);
  if (!base) return [];
  const out: ExpandedSlot[] = [];
  for (const slot of base.slots ?? []) {
    const opts = slot.options ?? [];
    const first = opts[0];
    if (!first) continue;
    if (first.standard) {
      const s = stdByKey.get(first.standard);
      if (!s) continue;
      const alternatives = opts.slice(1).map((o) => (o.standard ? stdByKey.get(o.standard) : undefined)).filter((x): x is CatalogStandard => !!x);
      out.push({ standard: s, target: slot.target && slot.target !== "self" ? slot.target : null, required: slot.required !== false, alternatives });
    } else if (first.item && depth === 0) {
      const sub = itemByKey.get(first.item);
      if (sub) out.push(...expandItem(sub, catalog, 1).map((e) => ({ ...e, target: slot.target && slot.target !== "self" ? slot.target : e.target })));
    }
  }
  return out;
}

// ── JSONB → 행 (AI 추출·승인·복제) ───────────────────────────────────

const stdOf = (d: LegacyDoc): string | null => {
  const s = String(d.std_key ?? "").trim();
  return s && s !== "__none__" ? s : null;
};
const targetOf = (d: LegacyDoc): string | null => {
  const t = String(d.target_person ?? "").trim();
  return t && t !== "self" ? t : null;
};
export const legacyItemKey = (d: LegacyDoc): string | null => {
  const s = stdOf(d);
  if (!s) return null;
  const t = targetOf(d);
  return t ? `item_${s}__${t}` : `item_${s}`;
};

/** JSONB 줄을 "그대로 둘 것"(작성서류·미연결)과 "항목으로 갈 것"(연결된 발급서류)으로 나눈다 */
export function splitLegacyDocs(docs: LegacyDoc[], formDocKeys: Set<string>): { keep: LegacyDoc[]; linked: LegacyDoc[] } {
  const keep: LegacyDoc[] = [];
  const linked: LegacyDoc[] = [];
  for (const d of docs) {
    if (isFormDoc(d, formDocKeys) || !stdOf(d)) keep.push(d);
    else linked.push(d);
  }
  return { keep, linked };
}

/** 연결된 발급서류 줄 → 행 (0060 규칙). 같은 항목이 두 번이면 앞의 것만. */
export function rowsFromLegacy(linked: LegacyDoc[], existingItemKeys: Set<string>, startOrder = 1): SpecDocItemRow[] {
  const out: SpecDocItemRow[] = [];
  const seen = new Set<string>();
  let order = startOrder;
  for (const d of linked) {
    const key = legacyItemKey(d);
    if (!key || seen.has(key) || !existingItemKeys.has(key)) continue;
    seen.add(key);
    const std = stdOf(d)!;
    const notarization = String(d.notarization ?? "").trim();
    out.push({
      item_key: key,
      required: d.required !== false,
      sort_order: order++,
      guide_override_ko: String(d.notes ?? "").trim() || null,
      guide_override_vi: null,
      overrides: notarization ? { standards: { [std]: { notarization } } } : {},
    });
  }
  return out;
}

/** 행 저장 — 없어진 행은 지우고, 있는 행은 갱신·추가 */
export async function writeSpecDocItemRows(supabase: Client, specId: string, rows: SpecDocItemRow[]): Promise<string | null> {
  const keys = rows.map((r) => r.item_key);
  const del = keys.length
    ? await supabase.from("study_spec_doc_items").delete().eq("spec_id", specId).not("item_key", "in", `(${keys.map((k) => `"${k}"`).join(",")})`)
    : await supabase.from("study_spec_doc_items").delete().eq("spec_id", specId);
  if (del.error) return `요강 항목 정리 실패: ${del.error.message}`;
  if (rows.length === 0) return null;
  const { error } = await supabase.from("study_spec_doc_items").upsert(
    rows.map((r, i) => ({
      spec_id: specId,
      item_key: r.item_key,
      required: r.required !== false,
      sort_order: i + 1,
      guide_override_ko: r.guide_override_ko?.trim() || null,
      guide_override_vi: r.guide_override_vi?.trim() || null,
      overrides: r.overrides ?? {},
    })),
    { onConflict: "spec_id,item_key" }
  );
  return error ? `요강 항목 저장 실패: ${error.message}` : null;
}

/**
 * JSONB 에서 행 만들기 — 이미 있는 행은 두고 빠진 것만 넣는다.
 * AI 추출 초안·승인·복제처럼 JSONB 가 먼저 생기는 곳에서 부른다.
 */
export async function syncSpecDocItemsFromLegacy(supabase: Client, specId: string): Promise<string | null> {
  const { data: spec } = await supabase.from("study_admission_specs").select("id, required_documents").eq("id", specId).maybeSingle();
  if (!spec) return "모집요강을 찾을 수 없습니다.";
  const docs = (Array.isArray(spec.required_documents) ? spec.required_documents : []) as LegacyDoc[];
  const [formDocKeys, { data: items }, existing] = await Promise.all([
    loadFormDocKeys(supabase),
    supabase.from("study_doc_items").select("key"),
    loadSpecDocItemRows(supabase, specId),
  ]);
  const { linked } = splitLegacyDocs(docs, formDocKeys);
  const have = new Set(existing.map((r) => r.item_key));
  const rows = rowsFromLegacy(linked, new Set((items ?? []).map((i) => i.key)), existing.length + 1).filter((r) => !have.has(r.item_key));
  if (rows.length === 0) return null;
  const { error } = await supabase.from("study_spec_doc_items").upsert(
    rows.map((r) => ({ spec_id: specId, ...r })),
    { onConflict: "spec_id,item_key", ignoreDuplicates: true }
  );
  return error ? `요강 항목 동기화 실패: ${error.message}` : null;
}

// ── 행 → JSONB 발급서류 줄 (abroad 전환 전까지의 캐시) ─────────────────

/**
 * 항목 행을 옛 JSONB 발급서류 줄로 그린다.
 *   · 서류 한 줄 = 항목의 베트남 기준 구성의 칸 하나. 대체 가능 서류는 메모에 적는다.
 *   · key(옛 A enum)는 예전 줄에 같은 서류·대상자가 있었으면 그 값을 잇고, 없으면 other.
 *   · notarization 은 요강 덮어쓰기 → 표준 순. notes 는 요강 안내문 → 항목 → 서류 순.
 */
export function renderLegacyFromRows(rows: SpecDocItemRow[], catalog: DocCatalog, prevDocs: LegacyDoc[]): LegacyDoc[] {
  const itemByKey = new Map(catalog.items.map((i) => [i.key, i]));
  const prevBy = new Map<string, LegacyDoc>();
  for (const d of prevDocs) {
    const s = stdOf(d);
    if (s) prevBy.set(`${s}|${targetOf(d) ?? ""}`, d);
  }
  const out: LegacyDoc[] = [];
  for (const r of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    const item = itemByKey.get(r.item_key);
    if (!item) continue;
    const ov = r.overrides?.standards ?? {};
    for (const e of expandItem(item, catalog)) {
      const s = e.standard;
      const prev = prevBy.get(`${s.key}|${e.target ?? ""}`);
      const o = ov[s.key] ?? {};
      const notarization = (o.notarization ?? s.notarization ?? "").trim() || null;
      const guide = r.guide_override_ko?.trim() || item.guide_ko?.trim() || s.guide_ko?.trim() || "";
      const alt = e.alternatives.length ? `대체 가능: ${e.alternatives.map((a) => a.name_ko).join(", ")}` : "";
      const conds: string[] = [];
      const validity = o.validity_days ?? s.validity_days;
      const within = o.issued_within_days ?? s.issued_within_days;
      const original = o.original_required ?? s.original_required;
      if (validity != null) conds.push(`유효기간 ${validity}일`);
      if (within != null) conds.push(`발급 후 ${within}일 이내`);
      if (original === true) conds.push("원본 제출");
      const notes = [guide, conds.join(" · "), alt].filter(Boolean).join("\n") || null;
      out.push({
        key: String(prev?.key ?? "other"),
        name_ko: e.target ? `${s.name_ko} (${TARGET_LABEL_KO[e.target] ?? e.target})` : s.name_ko,
        name_vi: s.name_vi ?? null,
        required: r.required !== false && e.required,
        issuer: s.issuer_ko ?? (prev?.issuer as string | null | undefined) ?? null,
        language: (prev?.language as string | null | undefined) ?? null,
        notarization,
        group: (prev?.group as string | null | undefined) ?? null,
        notes,
        std_key: s.key,
        target_person: e.target,
        item_key: r.item_key,
      });
    }
  }
  return out;
}

/**
 * 편집 화면 저장 — 항목 행이 정본. 옛 JSONB 는 [작성서류·미연결 줄] + [항목에서 그린 발급서류 줄].
 *   legacyDocs 안에 새로 연결된 발급서류(std_key 붙음)가 있으면 행으로 옮긴다.
 *   돌려주는 배열을 spec.required_documents 에 저장하면 된다.
 */
export async function saveSpecDocuments(
  supabase: Client,
  specId: string,
  input: { rows: SpecDocItemRow[]; legacyDocs: LegacyDoc[] }
): Promise<{ ok: true; required_documents: LegacyDoc[] } | { ok: false; error: string }> {
  const [formDocKeys, catalog, { data: spec }] = await Promise.all([
    loadFormDocKeys(supabase),
    loadDocCatalog(supabase),
    supabase.from("study_admission_specs").select("required_documents").eq("id", specId).maybeSingle(),
  ]);
  const prevDocs = (Array.isArray(spec?.required_documents) ? spec!.required_documents : []) as LegacyDoc[];
  const itemKeys = new Set(catalog.items.map((i) => i.key));

  const { keep, linked } = splitLegacyDocs(input.legacyDocs, formDocKeys);
  const rows: SpecDocItemRow[] = input.rows.filter((r) => itemKeys.has(r.item_key));
  const have = new Set(rows.map((r) => r.item_key));
  for (const r of rowsFromLegacy(linked, itemKeys, rows.length + 1)) if (!have.has(r.item_key)) { rows.push(r); have.add(r.item_key); }
  rows.forEach((r, i) => { r.sort_order = i + 1; });

  const err = await writeSpecDocItemRows(supabase, specId, rows);
  if (err) return { ok: false, error: err };

  const forms = keep.filter((d) => isFormDoc(d, formDocKeys));
  const unlinked = keep.filter((d) => !isFormDoc(d, formDocKeys));
  return { ok: true, required_documents: [...forms, ...renderLegacyFromRows(rows, catalog, prevDocs), ...unlinked] };
}
