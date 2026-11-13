"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { refreshSpecLegacyCaches } from "@/lib/admission/spec-departments";
import { syncSpecLegacyTerm } from "@/lib/admission/spec-merge";
import { setAtPath, type RefreshChange } from "@/lib/admission/spec-refresh";
import type { Json } from "@/types/database";

/**
 * 원본으로 갱신 — 화면에서 고른 항목만 적용한다.
 *   학과 열(info·tuition·scholarships·eligibility)과 학기 일정 열(schedule·schedule_language) 안의 키 단위로 넣는다.
 *   학과 자격이 비어 있으면 요강 공통 자격에서 시작해 학과 자격으로 저장한다.
 */
export async function applySpecRefreshAction(
  specId: string,
  changes: RefreshChange[]
): Promise<{ ok: true; applied: number } | { ok: false; error: string }> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user || !isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다" };
  if (!Array.isArray(changes) || changes.length === 0) return { ok: false, error: "고른 항목이 없습니다" };

  const admin = createAdminClient();
  const [{ data: spec }, { data: depts }, { data: terms }] = await Promise.all([
    admin.from("study_admission_specs").select("id, university_id, eligibility").eq("id", specId).maybeSingle(),
    admin.from("study_spec_departments").select("id, info, tuition, scholarships, eligibility").eq("spec_id", specId),
    admin.from("study_spec_terms").select("id, schedule, schedule_language").eq("spec_id", specId),
  ]);
  if (!spec) return { ok: false, error: "모집요강을 찾지 못했습니다" };

  // 행·열별로 모아 한 번에 쓴다
  const deptPatch = new Map<string, Record<string, unknown>>();
  const termPatch = new Map<string, Record<string, unknown>>();
  for (const c of changes) {
    const t = c.target;
    if (t.kind === "dept") {
      const row = (depts ?? []).find((d) => d.id === t.sdId);
      if (!row || !["info", "tuition", "scholarships", "eligibility"].includes(t.column)) return { ok: false, error: "대상 학과가 이 요강에 없습니다" };
      const patch = deptPatch.get(row.id) ?? {};
      let base: unknown = t.column in patch ? patch[t.column] : row[t.column];
      if (t.column === "eligibility" && !(t.column in patch)) {
        const own = row.eligibility as Record<string, unknown> | null;
        base = own && Object.keys(own).length ? own : (spec.eligibility ?? {});
      }
      patch[t.column] = setAtPath(base, c.path, c.value);
      deptPatch.set(row.id, patch);
    } else {
      const row = (terms ?? []).find((x) => x.id === t.termId);
      if (!row || !["schedule", "schedule_language"].includes(t.column)) return { ok: false, error: "대상 학기가 이 요강에 없습니다" };
      const patch = termPatch.get(row.id) ?? {};
      const base: unknown = t.column in patch ? patch[t.column] : row[t.column];
      patch[t.column] = setAtPath(base, c.path, c.value);
      termPatch.set(row.id, patch);
    }
  }

  const now = new Date().toISOString();
  for (const [id, patch] of deptPatch) {
    const { error } = await admin
      .from("study_spec_departments")
      .update({ ...(patch as Record<string, Json>), updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, error: `학과 저장 실패: ${error.message}` };
  }
  for (const [id, patch] of termPatch) {
    const { error } = await admin
      .from("study_spec_terms")
      .update({ ...(patch as Record<string, Json>), updated_at: now })
      .eq("id", id);
    if (error) return { ok: false, error: `일정 저장 실패: ${error.message}` };
  }
  await admin.from("study_admission_specs").update({ updated_at: now }).eq("id", specId);

  if (termPatch.size > 0) await syncSpecLegacyTerm(admin, specId);
  const cacheErr = await refreshSpecLegacyCaches(admin, specId);
  if (cacheErr) return { ok: false, error: cacheErr };

  revalidatePath(`/admissions/specs/${specId}`);
  revalidatePath(`/admissions/${spec.university_id}`);
  revalidatePath("/calendar");
  return { ok: true, applied: changes.length };
}
