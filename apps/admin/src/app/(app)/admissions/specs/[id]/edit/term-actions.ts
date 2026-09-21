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

/** 다른 학기 일정 복사 — keepDates 면 그대로(깊은 복사), 아니면 차수 이름만(blankSchedule). */
function copySchedule(src: unknown, keepDates: boolean): Record<string, unknown> {
  if (!keepDates) return blankSchedule(src);
  if (!src || typeof src !== "object") return { rounds: [] };
  return JSON.parse(JSON.stringify(src)) as Record<string, unknown>;
}

async function loadSpec(specId: string) {
  const admin = createAdminClient();
  const { data: spec } = await admin.from("study_admission_specs").select("id, university_id").eq("id", specId).maybeSingle();
  return { admin, spec };
}

/** 학기 카드 저장 — 학기 문자열·일정(일반학과 schedule · 어학당 schedule_language)·메모 */
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

    const parseSchedule = (key: string, label: string): { ok: true; value: unknown } | { ok: false; error: string } => {
      const raw = formData.get(key);
      if (typeof raw !== "string" || !raw.trim()) return { ok: true, value: {} };
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch (e) {
        return { ok: false, error: `${label} 일정 JSON 오류: ${e instanceof Error ? e.message : String(e)}` };
      }
    };
    const parsedSchedule = parseSchedule("term_schedule", "일반학과");
    if (!parsedSchedule.ok) return { ok: false, error: parsedSchedule.error };
    const parsedScheduleLanguage = parseSchedule("term_schedule_language", "어학당");
    if (!parsedScheduleLanguage.ok) return { ok: false, error: parsedScheduleLanguage.error };
    const schedule = parsedSchedule.value;
    const schedule_language = parsedScheduleLanguage.value;
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

    const { error } = await admin.from("study_spec_terms").update({ term, schedule, schedule_language, notes }).eq("id", termId);
    if (error) return { ok: false, error: `학기 저장 실패: ${error.message}` };
    await syncSpecLegacyTerm(admin, specId);
    revalidate(specId, spec.university_id);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 학기 추가 — 일정(일반학과·어학당 둘 다)은 비워 두거나, 다른 학기 일정을 가져온다.
 *   copy_from_term_id 는 이 요강뿐 아니라 다른 대학 요강의 학기여도 된다.
 *   keep_dates=false(기본) → 차수 이름만 가져오고 날짜는 비움(blankSchedule) / true → 그대로 복사.
 *   copy_departments 면 원본 학기에 모집 행이 있는 학과를 새 학기에도 draft 로 넣는다
 *   — 원본이 이 요강의 학기일 때만(다른 대학 학과는 이 요강의 학과가 아니다).
 */
export async function addSpecTermAction(
  specId: string,
  input: { term: string; copy_from_term_id?: string | null; copy_departments?: boolean; keep_dates?: boolean }
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
    let schedule_language: Record<string, unknown> = { rounds: [] };
    let srcTerm: string | null = null;
    let srcIsThisSpec = false;
    if (input.copy_from_term_id) {
      const { data: src } = await admin
        .from("study_spec_terms")
        .select("spec_id, term, schedule, schedule_language")
        .eq("id", input.copy_from_term_id)
        .maybeSingle();
      if (!src) return { ok: false, error: "복사할 원본 학기를 찾을 수 없습니다." };
      schedule = copySchedule(src.schedule, !!input.keep_dates);
      schedule_language = copySchedule(src.schedule_language, !!input.keep_dates);
      srcTerm = src.term;
      srcIsThisSpec = src.spec_id === specId;
    }
    const { data: created, error } = await admin
      .from("study_spec_terms")
      .insert({ spec_id: specId, term, schedule, schedule_language, sort_order: 0 })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: `학기 추가 실패: ${error?.message ?? "unknown"}` };

    if (input.copy_departments && srcTerm && srcIsThisSpec) {
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

/**
 * 기존 학기에 다른 학기 일정 가져오기 — 이 학기의 schedule(일반학과) / schedule_language(어학당)를 덮어쓴다.
 *   원본은 이 요강 또는 다른 대학 요강의 학기. keep_dates=false 면 차수 이름만(날짜 비움).
 *   학기 이름·메모·모집 학과는 건드리지 않는다.
 */
export async function importTermScheduleAction(
  specId: string,
  termId: string,
  input: { source_term_id: string; keep_dates?: boolean; regular: boolean; language: boolean }
): Promise<TermResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    if (!input.regular && !input.language) return { ok: false, error: "가져올 일정(일반학과/어학당)을 하나 이상 고르세요." };
    if (!input.source_term_id) return { ok: false, error: "원본 학기를 고르세요." };
    if (input.source_term_id === termId) return { ok: false, error: "같은 학기에서는 가져올 수 없습니다." };
    const { admin, spec } = await loadSpec(specId);
    if (!spec) return { ok: false, error: "모집요강을 찾을 수 없습니다." };
    const { data: row } = await admin.from("study_spec_terms").select("id, spec_id").eq("id", termId).maybeSingle();
    if (!row || row.spec_id !== specId) return { ok: false, error: "학기를 찾을 수 없습니다." };
    const { data: src } = await admin
      .from("study_spec_terms")
      .select("schedule, schedule_language")
      .eq("id", input.source_term_id)
      .maybeSingle();
    if (!src) return { ok: false, error: "원본 학기를 찾을 수 없습니다." };

    const keep = !!input.keep_dates;
    const patch: { schedule?: Record<string, unknown>; schedule_language?: Record<string, unknown> } = {};
    if (input.regular) patch.schedule = copySchedule(src.schedule, keep);
    if (input.language) patch.schedule_language = copySchedule(src.schedule_language, keep);
    const { error } = await admin.from("study_spec_terms").update(patch).eq("id", termId);
    if (error) return { ok: false, error: `일정 가져오기 실패: ${error.message}` };
    await syncSpecLegacyTerm(admin, specId);
    revalidate(specId, spec.university_id);
    return { ok: true, id: termId };
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
