"use server";

/**
 * 모집요강 편집 — 학기(study_spec_terms) 서버 액션.
 *   학기 = 일정. 그 학기에 모집하는 학과 = study_offerings 행(draft 는 여기서 넣고 뺀다, published 는 모집 메뉴 몫).
 */

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { blankSchedule, ensureDraftOffering, syncSpecLegacyTerm, TERM_RE } from "@/lib/admission/spec-merge";

export type TermActionState = { ok: true; savedAt: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | undefined;
export type TermResult = { ok: true; id?: string } | { ok: false; error: string };

async function guard(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

function revalidate(specId: string, universityId?: number) {
  revalidatePath("/admissions");
  revalidatePath("/offerings");
  revalidatePath(`/admissions/specs/${specId}`);
  revalidatePath(`/admissions/specs/${specId}/edit`);
  if (universityId) {
    revalidatePath(`/admissions/${universityId}`);
    revalidatePath(`/universities/${universityId}`);
  }
}

async function loadSpec(specId: string) {
  const admin = createAdminClient();
  const { data: spec } = await admin.from("study_admission_specs").select("id, university_id").eq("id", specId).maybeSingle();
  return { admin, spec };
}

/** 학기 카드 저장 — 학기 문자열·일정·메모 */
export async function saveSpecTermAction(specId: string, termId: string, _prev: TermActionState, formData: FormData): Promise<TermActionState> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const { admin, spec } = await loadSpec(specId);
    if (!spec) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const { data: row } = await admin.from("study_spec_terms").select("id, spec_id, term").eq("id", termId).maybeSingle();
    if (!row || row.spec_id !== specId) return { ok: false, error: "학기를 찾을 수 없습니다." };

    const term = String(formData.get("term") ?? "").trim();
    if (!TERM_RE.test(term)) return { ok: false, error: "학기 형식이 올바르지 않습니다 (예: 2027-Spring)", fieldErrors: { term: "예: 2027-Spring" } };

    let schedule: unknown = {};
    const raw = formData.get("term_schedule");
    if (typeof raw === "string" && raw.trim()) {
      try {
        schedule = JSON.parse(raw);
      } catch (e) {
        return { ok: false, error: `일정 JSON 오류: ${e instanceof Error ? e.message : String(e)}` };
      }
    }
    const notes = String(formData.get("term_notes") ?? "").trim() || null;

    if (term !== row.term) {
      const { data: dup } = await admin.from("study_spec_terms").select("id").eq("spec_id", specId).eq("term", term).maybeSingle();
      if (dup) return { ok: false, error: `${term} 학기가 이미 있습니다.`, fieldErrors: { term: "이미 있는 학기" } };
      // 학기 이름을 바꾸면 모집·지원서가 학기 문자열로 묶여 있어 초안 모집만 따라간다
      const { count: nonDraft } = await admin
        .from("study_offerings")
        .select("id", { count: "exact", head: true })
        .eq("university_id", spec.university_id)
        .eq("term", row.term)
        .neq("status", "draft");
      if ((nonDraft ?? 0) > 0) return { ok: false, error: "노출 중이거나 마감된 모집이 있는 학기는 이름을 바꿀 수 없습니다.", fieldErrors: { term: "모집 메뉴에서 관리" } };
      const { count: apps } = await admin.from("study_applications").select("id", { count: "exact", head: true }).eq("admission_spec_id", specId).eq("term", row.term);
      if ((apps ?? 0) > 0) return { ok: false, error: "이 학기로 지원한 학생이 있어 이름을 바꿀 수 없습니다.", fieldErrors: { term: "지원서 있음" } };
      await admin.from("study_offerings").update({ term }).eq("university_id", spec.university_id).eq("term", row.term).eq("status", "draft");
    }

    const { error } = await admin.from("study_spec_terms").update({ term, schedule, notes }).eq("id", termId);
    if (error) return { ok: false, error: `학기 저장 실패: ${error.message}` };
    await syncSpecLegacyTerm(admin, specId);
    revalidate(specId, spec.university_id);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 학기 추가 — 일정은 비워 두거나, 다른 학기 일정에서 차수 이름만 가져온다(날짜는 비움).
 *   copy_departments 면 원본 학기에 모집 행이 있는 학과를 새 학기에도 draft 로 넣는다.
 */
export async function addSpecTermAction(
  specId: string,
  input: { term: string; copy_from_term_id?: string | null; copy_departments?: boolean }
): Promise<TermResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const term = String(input.term ?? "").trim();
    if (!TERM_RE.test(term)) return { ok: false, error: "학기 형식이 올바르지 않습니다 (예: 2027-Spring)" };
    const { admin, spec } = await loadSpec(specId);
    if (!spec) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const { data: dup } = await admin.from("study_spec_terms").select("id").eq("spec_id", specId).eq("term", term).maybeSingle();
    if (dup) return { ok: false, error: `${term} 학기가 이미 있습니다.` };

    let schedule: Record<string, unknown> = { rounds: [] };
    let srcTerm: string | null = null;
    if (input.copy_from_term_id) {
      const { data: src } = await admin.from("study_spec_terms").select("term, schedule").eq("id", input.copy_from_term_id).eq("spec_id", specId).maybeSingle();
      if (src) {
        schedule = blankSchedule(src.schedule);
        srcTerm = src.term;
      }
    }
    const { data: created, error } = await admin
      .from("study_spec_terms")
      .insert({ spec_id: specId, term, schedule, sort_order: 0 })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: `학기 추가 실패: ${error?.message ?? "unknown"}` };

    if (input.copy_departments && srcTerm) {
      const { data: offs } = await admin.from("study_offerings").select("department_id, sort_order").eq("university_id", spec.university_id).eq("term", srcTerm);
      for (const o of offs ?? []) {
        const err = await ensureDraftOffering(admin, spec.university_id, o.department_id, term, specId, o.sort_order);
        if (err) return { ok: false, error: `학기는 추가됐지만 모집 행 복사에 실패했습니다: ${err}` };
      }
    }
    await syncSpecLegacyTerm(admin, specId);
    revalidate(specId, spec.university_id);
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 학기 삭제 — 노출/마감 모집이나 지원서가 있으면 막는다. 초안 모집 행은 함께 지운다. */
export async function deleteSpecTermAction(specId: string, termId: string): Promise<TermResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const { admin, spec } = await loadSpec(specId);
    if (!spec) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const { data: row } = await admin.from("study_spec_terms").select("id, spec_id, term").eq("id", termId).maybeSingle();
    if (!row || row.spec_id !== specId) return { ok: false, error: "학기를 찾을 수 없습니다." };

    const { count: nonDraft } = await admin
      .from("study_offerings")
      .select("id", { count: "exact", head: true })
      .eq("university_id", spec.university_id)
      .eq("term", row.term)
      .in("status", ["published", "closed"]);
    if ((nonDraft ?? 0) > 0) return { ok: false, error: "노출 중이거나 마감된 모집이 있는 학기는 지울 수 없습니다. 모집 메뉴에서 먼저 정리하세요." };
    const { count: apps } = await admin.from("study_applications").select("id", { count: "exact", head: true }).eq("admission_spec_id", specId).eq("term", row.term);
    if ((apps ?? 0) > 0) return { ok: false, error: `이 학기로 지원한 학생이 ${apps}명 있어 지울 수 없습니다.` };

    await admin.from("study_offerings").delete().eq("university_id", spec.university_id).eq("term", row.term).eq("status", "draft");
    const { error } = await admin.from("study_spec_terms").delete().eq("id", termId);
    if (error) return { ok: false, error: `학기 삭제 실패: ${error.message}` };
    await syncSpecLegacyTerm(admin, specId);
    revalidate(specId, spec.university_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 학기의 모집 학과 체크 — 켜면 draft 모집 행 추가, 끄면 draft 일 때만 삭제 */
export async function setTermDepartmentAction(specId: string, term: string, departmentId: number, on: boolean): Promise<TermResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const { admin, spec } = await loadSpec(specId);
    if (!spec) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const { data: sd } = await admin.from("study_spec_departments").select("id, sort_order").eq("spec_id", specId).eq("department_id", departmentId).maybeSingle();
    if (!sd) return { ok: false, error: "이 요강의 학과가 아닙니다." };
    if (on) {
      const err = await ensureDraftOffering(admin, spec.university_id, departmentId, term, specId, sd.sort_order);
      if (err) return { ok: false, error: err };
    } else {
      const { data: off } = await admin
        .from("study_offerings")
        .select("id, status")
        .eq("university_id", spec.university_id)
        .eq("department_id", departmentId)
        .eq("term", term)
        .maybeSingle();
      if (off && off.status !== "draft") return { ok: false, error: "초안이 아닌 모집은 여기서 뺄 수 없습니다. 모집 메뉴에서 관리하세요." };
      if (off) {
        const { error } = await admin.from("study_offerings").delete().eq("id", off.id);
        if (error) return { ok: false, error: `모집 행 삭제 실패: ${error.message}` };
      }
    }
    revalidate(specId, spec.university_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
