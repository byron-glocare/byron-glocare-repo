/**
 * 서류 카탈로그(표준·항목) 읽기 + 항목 펼치기 — abroad 읽기 전용 미러.
 *
 *   admin 의 lib/admission/spec-doc-items.ts 중 학생·센터 화면이 필요로 하는
 *   부분만 옮겼다(쓰기·JSONB 변환은 admin 몫). 규칙은 같다:
 *     · 항목(study_doc_items)의 variants 중 베트남(when.nationality=vn, 옛 데이터 when=null) 기준 구성을 쓴다.
 *     · 칸(slot)은 required=false 가 아니면 모두 필수. 칸 안의 options 중 하나만 내면 된다.
 *     · option 이 다른 항목이면 한 단계만 펼친다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

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

/** 조건 덮어쓰기 — 서류별. 표준과 다른 값만 들어 있다. */
export type StandardOverride = {
  validity_days?: number | null;
  notarization?: string | null;
  original_required?: boolean | null;
  issued_within_days?: number | null;
};
export type SpecDocOverrides = { standards?: Record<string, StandardOverride> };

export type SpecDocItemRow = {
  spec_department_id: string;
  item_key: string;
  required: boolean;
  sort_order: number;
  guide_override_ko: string | null;
  guide_override_vi: string | null;
  overrides: SpecDocOverrides;
};

const BASE_NATIONALITY = "vn";

export const TARGET_LABEL_KO: Record<string, string> = {
  self: "본인",
  father: "아버지",
  mother: "어머니",
  sponsor: "재정보증인",
  other: "기타",
};
export const TARGET_LABEL_VI: Record<string, string> = {
  self: "Bản thân",
  father: "Cha",
  mother: "Mẹ",
  sponsor: "Người bảo lãnh tài chính",
  other: "Khác",
};

// ── 카탈로그 ──────────────────────────────────────────────────────────

export async function loadDocCatalog(supabase: Client): Promise<DocCatalog> {
  const [{ data: items }, { data: standards }] = await Promise.all([
    supabase
      .from("study_doc_items")
      .select("key, name_ko, name_vi, guide_ko, guide_vi, variants, is_active")
      .order("sort_order")
      .order("name_ko"),
    supabase
      .from("study_doc_standards")
      .select(
        "key, name_ko, name_vi, issuer_ko, validity_days, notarization, original_required, issued_within_days, guide_ko, guide_vi, is_active, is_form_doc"
      )
      .eq("is_form_doc", false)
      .order("sort_order")
      .order("name_ko"),
  ]);
  return {
    items: (items ?? []).map((i) => ({
      key: i.key,
      name_ko: i.name_ko,
      name_vi: i.name_vi,
      guide_ko: i.guide_ko,
      guide_vi: i.guide_vi,
      variants: (Array.isArray(i.variants) ? i.variants : []) as DocVariant[],
      is_active: i.is_active,
    })),
    standards: (standards ?? []).map((s) => ({
      key: s.key,
      name_ko: s.name_ko,
      name_vi: s.name_vi,
      issuer_ko: s.issuer_ko,
      validity_days: s.validity_days,
      notarization: s.notarization,
      original_required: s.original_required,
      issued_within_days: s.issued_within_days,
      guide_ko: s.guide_ko,
      guide_vi: s.guide_vi,
      is_active: s.is_active,
    })),
  };
}

/** 요강 학과(study_spec_departments.id)별 항목 행. 학과 id → 행[] (sort_order 순) */
export async function loadSpecDocItemRowsByDepartment(
  supabase: Client,
  specDepartmentIds: string[]
): Promise<Map<string, SpecDocItemRow[]>> {
  const out = new Map<string, SpecDocItemRow[]>();
  if (specDepartmentIds.length === 0) return out;
  const { data } = await supabase
    .from("study_spec_doc_items")
    .select("spec_department_id, item_key, required, sort_order, guide_override_ko, guide_override_vi, overrides")
    .in("spec_department_id", specDepartmentIds)
    .order("sort_order");
  for (const r of data ?? []) {
    if (!r.spec_department_id) continue;
    if (!out.has(r.spec_department_id)) out.set(r.spec_department_id, []);
    out.get(r.spec_department_id)!.push({
      spec_department_id: r.spec_department_id,
      item_key: r.item_key,
      required: r.required,
      sort_order: r.sort_order,
      guide_override_ko: r.guide_override_ko,
      guide_override_vi: r.guide_override_vi,
      overrides: ((r.overrides ?? {}) as SpecDocOverrides) ?? {},
    });
  }
  return out;
}

// ── 펼치기 ────────────────────────────────────────────────────────────

/** 항목의 베트남 기준 구성 (옛 데이터 when=null 도 베트남) */
export function baseVariantOf(item: CatalogItem): DocVariant | null {
  const vs = item.variants ?? [];
  return (
    vs.find((v) => ((v.when?.nationality ?? "").trim() || BASE_NATIONALITY) === BASE_NATIONALITY) ??
    vs[0] ??
    null
  );
}

/** 한 항목이 실제로 요구하는 서류 줄 — 베트남 기준, 다른 항목은 한 단계만 펼친다 */
export type ExpandedSlot = {
  standard: CatalogStandard;
  target: string | null;
  required: boolean;
  alternatives: CatalogStandard[];
};
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
    const slotTarget = slot.target && slot.target !== "self" ? slot.target : null;
    if (first.standard) {
      const s = stdByKey.get(first.standard);
      if (!s) continue;
      const alternatives = opts
        .slice(1)
        .map((o) => (o.standard ? stdByKey.get(o.standard) : undefined))
        .filter((x): x is CatalogStandard => !!x);
      out.push({ standard: s, target: slotTarget, required: slot.required !== false, alternatives });
    } else if (first.item && depth === 0) {
      const sub = itemByKey.get(first.item);
      if (sub)
        out.push(
          ...expandItem(sub, catalog, 1).map((e) => ({ ...e, target: slotTarget ?? e.target }))
        );
    }
  }
  return out;
}
