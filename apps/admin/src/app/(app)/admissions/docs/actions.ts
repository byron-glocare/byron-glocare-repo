"use server";

/**
 * 제출서류 관리 — 서류(study_doc_standards) · 서류 항목(study_doc_items) 저장 액션.
 *
 *   구조 결정(2026-09-15, D1_DOC_ITEMS.md):
 *   · 서류 정의는 이 두 테이블에만 있다. 모집요강은 항목을 참조만 한다.
 *   · 서류를 등록하면 서류 1개짜리 항목(item_<서류키>)이 같이 생긴다 — 대학은 항목만 고른다.
 *   · 구성은 **나라 단위**다. "기본 구성"은 없다 — 지금은 전부 베트남이므로 베트남이 기준이고
 *     지울 수 없다. (옛 데이터의 when=null 은 베트남으로 읽는다.)
 *   · 구성 안: 칸은 모두, 칸 안은 하나만. 칸마다 대상자·필수 여부.
 *   · 작성서류(학교 양식)는 이 탭에서 다루지 않는다 — 작성서류 탭이 관리한다(0062).
 */

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

// ── 타입 (클라이언트와 공유) ────────────────────────────────────────────

export type DocOption = { standard?: string; item?: string };
export type DocSlot = {
  target: string | null;
  /** 이 칸이 필수인지. 없으면 필수. */
  required?: boolean;
  options: DocOption[];
};
export type DocVariant = {
  /** 나라(필수) + 재정보증인 유형(선택). */
  when: { nationality?: string; sponsor?: string } | null;
  slots: DocSlot[];
};

export const BASE_NATIONALITY = "vn";

export const NOTARIZATIONS = [
  "none",
  "translation_notarization",
  "consul",
  "consul_for_vietnam",
  "apostille",
  "apostille_or_consul",
] as const;

export type DocStandardInput = {
  key?: string | null; // 없으면 새 서류 (+ 서류 1개짜리 항목 자동 생성)
  name_ko: string;
  name_vi?: string | null;
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
  key?: string | null; // 없으면 새 항목
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

/** 예외를 화면 오류로 바꾼다 — 액션이 던지면 페이지 전체가 "server error" 로 죽는다. */
async function safely<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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
  return [
    {
      when: { nationality: BASE_NATIONALITY },
      slots: [{ target: null, required: true, options: [{ standard: standardKey }] }],
    },
  ];
}

/**
 * 구성 검증·정리.
 *   · when 이 없거나 나라가 없으면 베트남으로 읽는다 (옛 데이터 호환)
 *   · 베트남(보증인 조건 없음) 구성이 하나는 있어야 한다
 *   · 같은 (나라, 보증인) 구성이 둘이면 안 된다
 *   · 칸마다 선택지 1개 이상, 선택지는 실제로 있는 서류/항목만, 자기 자신 금지
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
  const seenWhen = new Set<string>();
  let hasBase = false;
  for (const v of variants) {
    const nationality = (v.when?.nationality ?? "").trim() || BASE_NATIONALITY;
    const sponsor = (v.when?.sponsor ?? "").trim() || undefined;
    const sig = `${nationality}|${sponsor ?? ""}`;
    if (seenWhen.has(sig)) return { ok: false, error: "같은 나라·보증인 조건의 구성이 두 개 있습니다." };
    seenWhen.add(sig);
    if (nationality === BASE_NATIONALITY && !sponsor) hasBase = true;

    const slots: DocSlot[] = [];
    for (const s of v.slots ?? []) {
      const options: DocOption[] = [];
      for (const o of s.options ?? []) {
        if (o.standard) {
          if (!haveStd.has(o.standard)) return { ok: false, error: `없는 서류를 가리킵니다: ${o.standard}` };
          options.push({ standard: o.standard });
        } else if (o.item) {
          if (!haveItem.has(o.item)) return { ok: false, error: `없는 항목을 가리킵니다: ${o.item}` };
          options.push({ item: o.item });
        }
      }
      if (options.length === 0) return { ok: false, error: "선택지가 비어 있는 칸이 있습니다." };
      slots.push({ target: trimOrNull(s.target), required: s.required !== false, options });
    }
    if (slots.length === 0) return { ok: false, error: "칸이 없는 구성이 있습니다." };
    cleaned.push({ when: { nationality, ...(sponsor ? { sponsor } : {}) }, slots });
  }
  if (!hasBase) return { ok: false, error: "베트남 구성은 지울 수 없습니다." };
  return { ok: true, variants: cleaned };
}

// ── 서류 ─────────────────────────────────────────────────────────────

export async function saveDocStandardAction(
  input: DocStandardInput
): Promise<ActionResult<{ key: string; itemKey: string | null }>> {
  return safely(async () => {
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
      is_form_doc: false, // 이 탭은 발급서류만 다룬다
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

    let itemKey: string | null = null;
    if (isNew) {
      // 새 서류면 서류 1개짜리 항목을 같이 만든다 — 대학은 항목만 고르므로.
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
      // 서류 1개짜리 자동 항목의 이름은 서류 이름을 따라간다 (대상자별 항목은 접미사 유지)
      await admin.from("study_doc_items").update({ name_ko, name_vi: row.name_vi }).eq("key", `item_${key}`);
    }

    revalidatePath("/admissions");
    return { ok: true, data: { key, itemKey } };
  });
}

// ── 서류 항목 ─────────────────────────────────────────────────────────

export async function saveDocItemAction(
  input: DocItemInput
): Promise<ActionResult<{ key: string }>> {
  return safely(async () => {
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
  });
}

/** 항목 비활성화 — 모집요강이 쓰고 있으면 막는다. */
export async function setDocItemActiveAction(key: string, active: boolean): Promise<ActionResult> {
  return safely(async () => {
    const g = await guard();
    if (!g.ok) return g;
    const admin = createAdminClient();
    if (!active) {
      const { count } = await admin
        .from("study_spec_doc_items")
        .select("id", { count: "exact", head: true })
        .eq("item_key", key);
      if ((count ?? 0) > 0)
        return { ok: false, error: `모집요강 ${count}건이 이 항목을 쓰고 있어 비활성화할 수 없습니다. 먼저 요강에서 빼세요.` };
    }
    const { error } = await admin.from("study_doc_items").update({ is_active: active }).eq("key", key);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admissions");
    return { ok: true, data: undefined };
  });
}

// ── 미연결 요강 서류 연결 ─────────────────────────────────────────────
//   0060 이 옮기지 못한 서류(표준 미연결)를 운영자가 서류에 붙인다.
//   과도기라 두 곳에 같이 쓴다: 옛 required_documents JSONB 의 std_key 와
//   새 study_spec_doc_items 행. 0060 의 변환 규칙(item_<서류키>[__대상자])과 똑같이 만든다.

export async function linkSpecDocAction(input: {
  specId: string;
  docIndex: number;
  /** 그 자리의 서류명 — 화면이 본 것과 DB 가 같은지 확인용 */
  docName: string;
  standardKey: string;
}): Promise<ActionResult<{ itemKey: string }>> {
  return safely(async () => {
    const g = await guard();
    if (!g.ok) return g;
    const admin = createAdminClient();

    const { data: std } = await admin
      .from("study_doc_standards")
      .select("key, name_ko, name_vi, sort_order, is_active")
      .eq("key", input.standardKey)
      .maybeSingle();
    if (!std) return { ok: false, error: "없는 서류입니다." };

    const { data: spec } = await admin
      .from("study_admission_specs")
      .select("id, required_documents")
      .eq("id", input.specId)
      .maybeSingle();
    if (!spec) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const docs = Array.isArray(spec.required_documents)
      ? [...(spec.required_documents as Record<string, unknown>[])]
      : [];
    const doc = docs[input.docIndex];
    if (!doc || String(doc.name_ko ?? "").trim() !== input.docName.trim())
      return { ok: false, error: "요강이 그새 바뀌었습니다. 화면을 새로고침하세요." };

    // 1) 옛 JSONB 에 std_key
    docs[input.docIndex] = { ...doc, std_key: std.key };
    const { error: e1 } = await admin
      .from("study_admission_specs")
      .update({ required_documents: docs })
      .eq("id", input.specId);
    if (e1) return { ok: false, error: `요강 저장 실패: ${e1.message}` };

    // 2) 항목 키 — 대상자가 있으면 대상자별 항목(없으면 만든다)
    const target = String(doc.target_person ?? "").trim();
    const withTarget = target !== "" && target !== "self";
    const itemKey = withTarget ? `item_${std.key}__${target}` : `item_${std.key}`;
    const { data: item } = await admin.from("study_doc_items").select("key").eq("key", itemKey).maybeSingle();
    if (!item) {
      const TL: Record<string, [string, string]> = { father: ["아버지", "bố"], mother: ["어머니", "mẹ"], other: ["기타", "khác"] };
      const [ko, vi] = TL[target] ?? [target, target];
      const { error: e2 } = await admin.from("study_doc_items").insert({
        key: itemKey,
        name_ko: withTarget ? `${std.name_ko} (${ko})` : std.name_ko,
        name_vi: std.name_vi ? (withTarget ? `${std.name_vi} (${vi})` : std.name_vi) : null,
        variants: [
          {
            when: { nationality: BASE_NATIONALITY },
            slots: [{ target: withTarget ? target : null, required: true, options: [{ standard: std.key }] }],
          },
        ],
        sort_order: std.sort_order,
        is_active: std.is_active,
      });
      if (e2) return { ok: false, error: `항목 생성 실패: ${e2.message}` };
    }

    // 3) 새 구조의 요강↔항목 행 (있으면 그대로)
    const notarization = String(doc.notarization ?? "").trim();
    const { error: e3 } = await admin.from("study_spec_doc_items").upsert(
      {
        spec_id: input.specId,
        item_key: itemKey,
        required: doc.required !== false,
        sort_order: input.docIndex + 1,
        guide_override_ko: String(doc.notes ?? "").trim() || null,
        overrides: notarization ? { standards: { [std.key]: { notarization } } } : {},
      },
      { onConflict: "spec_id,item_key", ignoreDuplicates: true }
    );
    if (e3) return { ok: false, error: `항목 연결 실패: ${e3.message}` };

    revalidatePath("/admissions");
    revalidatePath(`/admissions/specs/${input.specId}`);
    return { ok: true, data: { itemKey } };
  });
}
