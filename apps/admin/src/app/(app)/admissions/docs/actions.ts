"use server";

/**
 * 제출서류 관리 — 서류(study_doc_standards) · 서류 항목(study_doc_items) 저장 액션.
 *
 *   구조 결정(2026-09-15, 설계 페이지 참고):
 *   · 서류 정의는 이 두 테이블에만 있다. 모집요강은 항목을 참조만 한다.
 *   · 서류를 등록하면 서류 1개짜리 항목(item_<서류키>)이 같이 생긴다 — 대학은 항목만 고른다.
 *   · 항목의 구성(variants)은 "칸은 모두, 칸 안은 하나만". 조건은 국적·재정보증인 둘뿐.
 */

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

// ── 타입 (클라이언트와 공유) ────────────────────────────────────────────

export type DocOption = { standard?: string; item?: string };
export type DocSlot = { target: string | null; options: DocOption[] };
export type DocVariant = {
  when: { nationality?: string; sponsor?: string } | null;
  slots: DocSlot[];
};

export const NOTARIZATIONS = [
  "none",
  "translation_notarization",
  "consul",
  "consul_for_vietnam",
  "apostille",
  "apostille_or_consul",
] as const;

export const TARGETS = ["self", "father", "mother", "sponsor"] as const;
export const NATIONALITIES = ["vn", "cn", "mn", "uz", "la", "other"] as const;
export const SPONSORS = ["parent", "relative", "company"] as const;

export type DocStandardInput = {
  key?: string | null; // 없으면 새 서류 (+ 서류 1개짜리 항목 자동 생성)
  name_ko: string;
  name_vi?: string | null;
  is_form_doc?: boolean;
  issuing_country?: string | null;
  issuer_ko?: string | null;
  issuer_vi?: string | null;
  validity_days?: number | null;
  notarization?: string | null;
  original_required?: boolean | null;
  issued_within_days?: number | null;
  guide_ko?: string | null;
  guide_vi?: string | null;
  aliases?: string[];
  sort_order?: number;
  is_active?: boolean;
};

export type DocItemInput = {
  key?: string | null; // 없으면 새 항목(묶음)
  name_ko: string;
  name_vi?: string | null;
  guide_ko?: string | null;
  guide_vi?: string | null;
  variants: DocVariant[];
  sort_order?: number;
  is_active?: boolean;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── 공통 ─────────────────────────────────────────────────────────────

async function guard(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

/** 뜻을 담지 않는 키 — 라벨·카테고리는 바뀌어도 키는 못 바꾸므로 */
function randomKey(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}

const trimOrNull = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};
const intOrNull = (v: number | null | undefined): number | null =>
  v == null || Number.isNaN(v) ? null : Math.max(0, Math.trunc(v));

function oneDocVariant(standardKey: string): DocVariant[] {
  return [{ when: null, slots: [{ target: null, options: [{ standard: standardKey }] }] }];
}

/**
 * 구성 검증 — 저장 전에 모양을 확인한다.
 *   · 칸마다 선택지 1개 이상
 *   · 선택지는 실제로 있는 서류/항목만
 *   · 자기 자신을 가리키는 항목 금지
 *   · 조건 키는 nationality / sponsor 만
 */
async function validateVariants(
  variants: DocVariant[],
  selfKey: string | null
): Promise<{ ok: true; variants: DocVariant[] } | { ok: false; error: string }> {
  if (!Array.isArray(variants) || variants.length === 0)
    return { ok: false, error: "구성이 최소 하나 필요합니다." };

  const admin = createAdminClient();
  const stdKeys = new Set<string>();
  const itemKeys = new Set<string>();
  for (const v of variants)
    for (const s of v.slots ?? [])
      for (const o of s.options ?? []) {
        if (o.standard) stdKeys.add(o.standard);
        if (o.item) itemKeys.add(o.item);
      }
  if (selfKey && itemKeys.has(selfKey))
    return { ok: false, error: "항목이 자기 자신을 선택지로 가질 수 없습니다." };

  const [{ data: stds }, { data: items }] = await Promise.all([
    stdKeys.size
      ? admin.from("study_doc_standards").select("key").in("key", Array.from(stdKeys))
      : Promise.resolve({ data: [] as { key: string }[] }),
    itemKeys.size
      ? admin.from("study_doc_items").select("key").in("key", Array.from(itemKeys))
      : Promise.resolve({ data: [] as { key: string }[] }),
  ]);
  const haveStd = new Set((stds ?? []).map((r) => r.key));
  const haveItem = new Set((items ?? []).map((r) => r.key));

  const cleaned: DocVariant[] = [];
  let hasDefault = false;
  for (const v of variants) {
    const when =
      v.when && (v.when.nationality || v.when.sponsor)
        ? {
            ...(v.when.nationality ? { nationality: v.when.nationality } : {}),
            ...(v.when.sponsor ? { sponsor: v.when.sponsor } : {}),
          }
        : null;
    if (when === null) hasDefault = true;
    const slots: DocSlot[] = [];
    for (const s of v.slots ?? []) {
      const options: DocOption[] = [];
      for (const o of s.options ?? []) {
        if (o.standard) {
          if (!haveStd.has(o.standard))
            return { ok: false, error: `없는 서류를 가리킵니다: ${o.standard}` };
          options.push({ standard: o.standard });
        } else if (o.item) {
          if (!haveItem.has(o.item))
            return { ok: false, error: `없는 항목을 가리킵니다: ${o.item}` };
          options.push({ item: o.item });
        }
      }
      if (options.length === 0)
        return { ok: false, error: "선택지가 비어 있는 칸이 있습니다." };
      slots.push({ target: trimOrNull(s.target) as string | null, options });
    }
    if (slots.length === 0) return { ok: false, error: "칸이 없는 구성이 있습니다." };
    cleaned.push({ when, slots });
  }
  if (!hasDefault)
    return { ok: false, error: "조건 없는 기본 구성이 하나 있어야 합니다." };
  return { ok: true, variants: cleaned };
}

// ── 서류 ─────────────────────────────────────────────────────────────

export async function saveDocStandardAction(
  input: DocStandardInput
): Promise<ActionResult<{ key: string; itemKey: string | null }>> {
  const g = await guard();
  if (!g.ok) return g;
  const name_ko = (input.name_ko ?? "").trim();
  if (!name_ko) return { ok: false, error: "서류 이름을 입력하세요." };
  if (input.notarization && !NOTARIZATIONS.includes(input.notarization as never))
    return { ok: false, error: "인증 방식 값이 올바르지 않습니다." };

  const admin = createAdminClient();
  const isNew = !input.key;
  const key = input.key ?? randomKey("doc_");

  const row = {
    key,
    name_ko,
    name_vi: trimOrNull(input.name_vi),
    is_form_doc: !!input.is_form_doc,
    issuing_country: trimOrNull(input.issuing_country),
    issuer_ko: trimOrNull(input.issuer_ko),
    issuer_vi: trimOrNull(input.issuer_vi),
    validity_days: intOrNull(input.validity_days),
    notarization: trimOrNull(input.notarization),
    original_required: input.original_required ?? null,
    issued_within_days: intOrNull(input.issued_within_days),
    guide_ko: trimOrNull(input.guide_ko),
    guide_vi: trimOrNull(input.guide_vi),
    aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean),
    sort_order: input.sort_order ?? 0,
    is_active: input.is_active ?? true,
  };

  const { error } = await admin.from("study_doc_standards").upsert(row, { onConflict: "key" });
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  // 새 서류면 서류 1개짜리 항목을 같이 만든다 — 대학은 항목만 고르므로.
  let itemKey: string | null = null;
  if (isNew) {
    itemKey = `item_${key}`;
    const { error: e2 } = await admin.from("study_doc_items").insert({
      key: itemKey,
      name_ko,
      name_vi: row.name_vi,
      variants: oneDocVariant(key),
      sort_order: row.sort_order,
      is_active: true,
    });
    if (e2) return { ok: false, error: `항목 생성 실패: ${e2.message}` };
  } else {
    // 서류 1개짜리 자동 항목의 이름은 서류 이름을 따라간다
    await admin
      .from("study_doc_items")
      .update({ name_ko, name_vi: row.name_vi })
      .eq("key", `item_${key}`);
  }

  revalidatePath("/admissions");
  return { ok: true, data: { key, itemKey } };
}

// ── 서류 항목 ─────────────────────────────────────────────────────────

export async function saveDocItemAction(
  input: DocItemInput
): Promise<ActionResult<{ key: string }>> {
  const g = await guard();
  if (!g.ok) return g;
  const name_ko = (input.name_ko ?? "").trim();
  if (!name_ko) return { ok: false, error: "항목 이름을 입력하세요." };

  const key = input.key ?? randomKey("item_");
  const v = await validateVariants(input.variants, key);
  if (!v.ok) return v;

  const admin = createAdminClient();
  const { error } = await admin.from("study_doc_items").upsert(
    {
      key,
      name_ko,
      name_vi: trimOrNull(input.name_vi),
      guide_ko: trimOrNull(input.guide_ko),
      guide_vi: trimOrNull(input.guide_vi),
      variants: v.variants,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    },
    { onConflict: "key" }
  );
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  revalidatePath("/admissions");
  return { ok: true, data: { key } };
}

/** 항목 비활성화 — 모집요강이 쓰고 있으면 막는다. */
export async function setDocItemActiveAction(
  key: string,
  active: boolean
): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  const admin = createAdminClient();
  if (!active) {
    const { count } = await admin
      .from("study_spec_doc_items")
      .select("id", { count: "exact", head: true })
      .eq("item_key", key);
    if ((count ?? 0) > 0)
      return {
        ok: false,
        error: `모집요강 ${count}건이 이 항목을 쓰고 있어 비활성화할 수 없습니다. 먼저 요강에서 빼세요.`,
      };
  }
  const { error } = await admin
    .from("study_doc_items")
    .update({ is_active: active })
    .eq("key", key);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admissions");
  return { ok: true, data: undefined };
}
