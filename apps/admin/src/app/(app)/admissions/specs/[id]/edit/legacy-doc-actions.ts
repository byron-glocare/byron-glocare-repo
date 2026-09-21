"use server";

/**
 * 모집요강 편집 기본 탭 — 옛 required_documents JSONB 의 "작성서류·미연결" 줄 정리.
 *   줄마다: 학과에 넣기(발급서류 항목으로) 또는 삭제. 남은 줄이 없으면 섹션이 사라진다.
 *   줄은 JSONB 배열 index + 이름으로 찾는다(다른 저장으로 순서가 바뀌었으면 같은 이름의 유일한 줄로 찾는다).
 *   바뀐 뒤엔 refreshSpecLegacyCaches — 남은 작성서류·미연결 줄은 그대로 유지된다.
 */

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { isFormDoc } from "@/lib/admission/classify-documents";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import { expandItem, loadDocCatalog, type LegacyDoc, type SpecDocOverrides } from "@/lib/admission/spec-doc-items";
import { refreshSpecLegacyCaches } from "@/lib/admission/spec-departments";

export type LegacyRowResult = { ok: true } | { ok: false; error: string };

async function guard(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

function revalidate(specId: string, universityId?: number) {
  revalidatePath("/admissions");
  revalidatePath(`/admissions/specs/${specId}`);
  revalidatePath(`/admissions/specs/${specId}/edit`);
  if (universityId) revalidatePath(`/admissions/${universityId}`);
}

const nameOf = (d: LegacyDoc) => String(d.name_ko ?? "").trim();

/** 작성서류·미연결 줄인가 (편집 화면 splitLegacyDocs 의 keep 과 같은 기준) */
function isKeepRow(d: LegacyDoc, formDocKeys: Set<string>): boolean {
  const std = String(d.std_key ?? "").trim();
  return isFormDoc(d, formDocKeys) || std === "" || std === "__none__";
}

/** index + 이름으로 줄 찾기. 어긋나면 같은 이름의 유일한 keep 줄. */
function locate(docs: LegacyDoc[], index: number, nameKo: string, formDocKeys: Set<string>): number | null {
  const want = String(nameKo ?? "").trim();
  const at = docs[index];
  if (at && nameOf(at) === want && isKeepRow(at, formDocKeys)) return index;
  const hits: number[] = [];
  docs.forEach((d, i) => {
    if (nameOf(d) === want && isKeepRow(d, formDocKeys)) hits.push(i);
  });
  return hits.length === 1 ? hits[0] : null;
}

async function loadSpecDocs(admin: ReturnType<typeof createAdminClient>, specId: string) {
  const { data: spec } = await admin.from("study_admission_specs").select("id, university_id, required_documents").eq("id", specId).maybeSingle();
  if (!spec) return null;
  return { universityId: spec.university_id as number, docs: (Array.isArray(spec.required_documents) ? spec.required_documents : []) as LegacyDoc[] };
}

async function removeRow(admin: ReturnType<typeof createAdminClient>, specId: string, docs: LegacyDoc[], at: number): Promise<string | null> {
  const next = docs.filter((_, i) => i !== at);
  const { error } = await admin.from("study_admission_specs").update({ required_documents: next }).eq("id", specId);
  return error ? `옛 서류 줄 삭제 실패: ${error.message}` : null;
}

/** 옛 줄 삭제 */
export async function deleteLegacyDocRowAction(specId: string, index: number, nameKo: string): Promise<LegacyRowResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const admin = createAdminClient();
    const [s, formDocKeys] = await Promise.all([loadSpecDocs(admin, specId), loadFormDocKeys(admin)]);
    if (!s) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const at = locate(s.docs, index, nameKo, formDocKeys);
    if (at == null) return { ok: false, error: "줄을 찾을 수 없습니다. 새로고침 후 다시 시도하세요." };
    const err = await removeRow(admin, specId, s.docs, at);
    if (err) return { ok: false, error: err };
    const cacheErr = await refreshSpecLegacyCaches(admin, specId);
    if (cacheErr) return { ok: false, error: cacheErr };
    revalidate(specId, s.universityId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 옛 줄 → 학과 발급서류 항목.
 *   고른 학과마다 항목 행을 끝에 추가(이미 있으면 건너뜀). 안내문 = 줄 메모.
 *   줄에 공증 조건이 있고 항목의 서류가 하나뿐이면 그 서류의 공증 덮어쓰기로 넣는다.
 *   그 다음 줄을 JSONB 에서 지운다.
 */
export async function moveLegacyDocRowToDepartmentsAction(
  specId: string,
  index: number,
  nameKo: string,
  itemKey: string,
  sdIds: string[]
): Promise<LegacyRowResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const targets = Array.from(new Set((sdIds ?? []).filter((x) => typeof x === "string" && x)));
    if (!itemKey) return { ok: false, error: "발급서류 항목을 고르세요." };
    if (targets.length === 0) return { ok: false, error: "넣을 학과를 하나 이상 고르세요." };
    const admin = createAdminClient();
    const [s, formDocKeys, catalog, { data: depts }] = await Promise.all([
      loadSpecDocs(admin, specId),
      loadFormDocKeys(admin),
      loadDocCatalog(admin),
      admin.from("study_spec_departments").select("id").eq("spec_id", specId).in("id", targets),
    ]);
    if (!s) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const item = catalog.items.find((i) => i.key === itemKey);
    if (!item) return { ok: false, error: "발급서류 항목을 찾을 수 없습니다." };
    const validIds = new Set((depts ?? []).map((d) => d.id));
    if (validIds.size !== targets.length) return { ok: false, error: "이 요강의 학과가 아닌 것이 섞여 있습니다." };
    const at = locate(s.docs, index, nameKo, formDocKeys);
    if (at == null) return { ok: false, error: "줄을 찾을 수 없습니다. 새로고침 후 다시 시도하세요." };
    const row = s.docs[at];

    const notes = String(row.notes ?? "").trim() || null;
    const notarization = String(row.notarization ?? "").trim();
    let overrides: SpecDocOverrides = {};
    if (notarization) {
      const stds = Array.from(new Set(expandItem(item, catalog).map((e) => e.standard.key)));
      if (stds.length === 1) overrides = { standards: { [stds[0]]: { notarization } } };
    }

    const { data: existing } = await admin.from("study_spec_doc_items").select("spec_department_id, item_key, sort_order").in("spec_department_id", targets);
    for (const sdId of targets) {
      const mine = (existing ?? []).filter((r) => r.spec_department_id === sdId);
      if (mine.some((r) => r.item_key === itemKey)) continue;
      const sort = mine.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0) + 1;
      const { error } = await admin.from("study_spec_doc_items").insert({
        spec_id: specId,
        spec_department_id: sdId,
        item_key: itemKey,
        required: row.required !== false,
        sort_order: sort,
        guide_override_ko: notes,
        guide_override_vi: null,
        overrides,
      });
      if (error) return { ok: false, error: `항목 추가 실패: ${error.message}` };
    }

    // 항목 추가 뒤 JSONB 를 다시 읽어 줄을 지운다(그 사이 순서가 바뀌었을 수 있다)
    const s2 = await loadSpecDocs(admin, specId);
    if (s2) {
      const at2 = locate(s2.docs, at, nameKo, formDocKeys);
      if (at2 != null) {
        const err = await removeRow(admin, specId, s2.docs, at2);
        if (err) return { ok: false, error: err };
      }
    }
    const cacheErr = await refreshSpecLegacyCaches(admin, specId);
    if (cacheErr) return { ok: false, error: cacheErr };
    revalidate(specId, s.universityId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
