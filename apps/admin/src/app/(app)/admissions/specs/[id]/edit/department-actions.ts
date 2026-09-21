"use server";

/**
 * 모집요강 편집 — 학과(study_spec_departments) 서버 액션.
 *   학과마다 따로 저장한다. 바뀐 뒤엔 옛 JSONB 캐시(required_documents·departments)를 다시 그린다.
 */

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import {
  copyDepartmentSetup,
  refreshSpecLegacyCaches,
  writeDepartmentDocItems,
  type DepartmentInfo,
  type SpecDocItemRow,
} from "@/lib/admission/spec-departments";
import { normDeptName } from "@/lib/admission/spec-merge";

export type DeptActionState = { ok: true; savedAt: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | undefined;
export type DeptResult = { ok: true; id?: string } | { ok: false; error: string };
export type CopyWhat = { docs?: boolean; forms?: boolean; tuition?: boolean; scholarships?: boolean; eligibility?: boolean };

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
  if (universityId) {
    revalidatePath(`/admissions/${universityId}`);
    revalidatePath(`/universities/${universityId}`);
  }
}

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T | { __error: string } {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    return { __error: e instanceof Error ? e.message : String(e) };
  }
}
const isErr = (v: unknown): v is { __error: string } => !!v && typeof v === "object" && "__error" in (v as object);

const numOrNull = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** 학과 카드 저장 — 마스터·정보·학비·장학금·자격(학과별)·발급서류 항목·활성·(어학당) 어학연수 프로그램 */
export async function saveSpecDepartmentAction(
  specId: string,
  sdId: string,
  _prev: DeptActionState,
  formData: FormData
): Promise<DeptActionState> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const admin = createAdminClient();
    const { data: sd } = await admin
      .from("study_spec_departments")
      .select("id, spec_id, kind, info, department_id, study_admission_specs(university_id)")
      .eq("id", sdId)
      .maybeSingle();
    if (!sd || sd.spec_id !== specId) return { ok: false, error: "요강 학과를 찾을 수 없습니다." };
    const universityId = (sd.study_admission_specs as unknown as { university_id: number } | null)?.university_id;

    const departmentId = numOrNull(formData.get("department_id"));
    if (!departmentId) return { ok: false, error: "학과 마스터를 고르세요.", fieldErrors: { department_id: "학과 마스터를 고르세요." } };
    if (departmentId !== sd.department_id) {
      const { data: master } = await admin.from("departments").select("id, university_id").eq("id", departmentId).maybeSingle();
      if (!master || master.university_id !== universityId) return { ok: false, error: "이 대학의 학과가 아닙니다." };
      const { data: dup } = await admin.from("study_spec_departments").select("id").eq("spec_id", specId).eq("department_id", departmentId).neq("id", sdId).maybeSingle();
      if (dup) return { ok: false, error: "같은 학과 마스터를 쓰는 요강 학과가 이미 있습니다." };
    }

    const tuition = parseJson<Record<string, unknown>>(formData.get("dept_tuition"), {});
    if (isErr(tuition)) return { ok: false, error: `학비 JSON 오류: ${tuition.__error}` };
    const scholarships = parseJson<unknown[]>(formData.get("dept_scholarships"), []);
    if (isErr(scholarships)) return { ok: false, error: `장학금 JSON 오류: ${scholarships.__error}` };
    // 자격은 학과별(0068) — 비어 있어도 {} 로 저장한다(null 은 "옛 요강 공통을 씀"이었으나 폐기)
    const eligibilityParsed = parseJson<Record<string, unknown>>(formData.get("dept_eligibility"), {});
    if (isErr(eligibilityParsed)) return { ok: false, error: `자격 JSON 오류: ${eligibilityParsed.__error}` };
    const eligibility: Record<string, unknown> =
      eligibilityParsed && typeof eligibilityParsed === "object" && !Array.isArray(eligibilityParsed) ? eligibilityParsed : {};
    const rows = parseJson<SpecDocItemRow[]>(formData.get("dept_doc_items"), []);
    if (isErr(rows)) return { ok: false, error: `발급서류 항목 JSON 오류: ${rows.__error}` };
    if (!Array.isArray(rows)) return { ok: false, error: "발급서류 항목이 배열이 아닙니다." };

    const prevInfo = ((sd.info ?? {}) as DepartmentInfo) ?? {};
    const info: DepartmentInfo = {
      ...prevInfo,
      faculty: String(formData.get("info_faculty") ?? "").trim() || null,
      track: String(formData.get("info_track") ?? "").trim() || null,
      years: numOrNull(formData.get("info_years")),
      capacity: (() => {
        const raw = String(formData.get("info_capacity") ?? "").trim();
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : raw;
      })(),
      korean_min_topik: numOrNull(formData.get("info_topik")),
      notes: String(formData.get("info_notes") ?? "").trim() || null,
      program_kind: sd.kind === "language" ? "language" : "degree",
    };
    // 이름은 학과 마스터를 따른다 (옛 JSONB 캐시는 departmentsJsonFrom 이 마스터 이름을 넣는다)
    delete info.name;
    // 어학연수 프로그램 — 어학당만. 빈 값은 빼고, 전부 비면 키 자체를 뺀다.
    if (sd.kind === "language") {
      const strOrNull = (k: string): string | null => String(formData.get(k) ?? "").trim() || null;
      const lp: NonNullable<DepartmentInfo["language_program"]> = {};
      const nums = [
        ["hours_per_semester", "lp_hours_per_semester"],
        ["hours_per_week", "lp_hours_per_week"],
        ["weeks_per_semester", "lp_weeks_per_semester"],
      ] as const;
      for (const [key, field] of nums) {
        const n = numOrNull(formData.get(field));
        if (n != null) lp[key] = n;
      }
      const strs = [
        ["weekly_schedule", "lp_weekly_schedule"],
        ["visa_type", "lp_visa_type"],
        ["visa_extension", "lp_visa_extension"],
      ] as const;
      for (const [key, field] of strs) {
        const s = strOrNull(field);
        if (s) lp[key] = s;
      }
      if (Object.keys(lp).length > 0) info.language_program = lp;
      else delete info.language_program;
    } else {
      delete info.language_program;
    }
    // 모집요강 PDF 문구(베트남어) — 빈 값은 빼고, 전부 비면 키 자체를 뺀다.
    {
      const bv: NonNullable<DepartmentInfo["brochure_vi"]> = {};
      const fields = [
        ["program_intro", "brochure_program_intro"],
        ["preferences", "brochure_preferences"],
        ["career_outlook", "brochure_career_outlook"],
        ["school_strengths", "brochure_school_strengths"],
        ["dormitory", "brochure_dormitory"],
        ["schedule_note", "brochure_schedule_note"],
      ] as const;
      for (const [key, field] of fields) {
        const s = String(formData.get(field) ?? "").replace(/\r\n/g, "\n").trim();
        if (s) bv[key] = s;
      }
      if (Object.keys(bv).length > 0) info.brochure_vi = bv;
      else delete info.brochure_vi;
    }

    const { error } = await admin
      .from("study_spec_departments")
      .update({
        department_id: departmentId,
        info,
        tuition,
        scholarships,
        eligibility,
        is_active: formData.get("is_active") === "on",
      })
      .eq("id", sdId);
    if (error) return { ok: false, error: `학과 저장 실패: ${error.message}` };

    const rowErr = await writeDepartmentDocItems(admin, specId, sdId, rows);
    if (rowErr) return { ok: false, error: rowErr };

    const cacheErr = await refreshSpecLegacyCaches(admin, specId);
    if (cacheErr) return { ok: false, error: cacheErr };
    revalidate(specId, universityId);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 활성/비활성 토글 */
export async function setSpecDepartmentActiveAction(specId: string, sdId: string, active: boolean): Promise<DeptResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("study_spec_departments").update({ is_active: active }).eq("id", sdId).eq("spec_id", specId);
    if (error) return { ok: false, error: error.message };
    const cacheErr = await refreshSpecLegacyCaches(admin, specId);
    if (cacheErr) return { ok: false, error: cacheErr };
    revalidate(specId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 일반학과 삭제 — 어학당은 못 지운다.
 *   이 요강으로 이 학과에 지원한 학생이 있거나, 노출 중(published)/마감(closed) 모집이 있으면 막는다.
 *   초안 모집 행은 함께 지우고, 이 학과의 현행 양식은 현행에서 내린다(파일은 남는다).
 */
export async function deleteSpecDepartmentAction(specId: string, sdId: string): Promise<DeptResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const admin = createAdminClient();
    const { data: sd } = await admin
      .from("study_spec_departments")
      .select("id, spec_id, kind, department_id, study_admission_specs(university_id)")
      .eq("id", sdId)
      .maybeSingle();
    if (!sd || sd.spec_id !== specId) return { ok: false, error: "요강 학과를 찾을 수 없습니다." };
    if (sd.kind === "language") return { ok: false, error: "어학당은 지울 수 없습니다. 비활성으로 두세요." };
    const universityId = (sd.study_admission_specs as unknown as { university_id: number } | null)?.university_id;
    if (!universityId) return { ok: false, error: "대학을 찾을 수 없습니다." };

    const { count: appCount } = await admin
      .from("study_applications")
      .select("id", { count: "exact", head: true })
      .eq("admission_spec_id", specId)
      .eq("target_department_id", sd.department_id);
    if ((appCount ?? 0) > 0) return { ok: false, error: `이 학과에 지원한 학생이 ${appCount}명 있어 지울 수 없습니다. 비활성으로 두세요.` };

    const { count: pubCount } = await admin
      .from("study_offerings")
      .select("id", { count: "exact", head: true })
      .eq("university_id", universityId)
      .eq("department_id", sd.department_id)
      .in("status", ["published", "closed"]);
    if ((pubCount ?? 0) > 0) return { ok: false, error: "노출 중이거나 마감된 모집이 있어 지울 수 없습니다. 모집 메뉴에서 먼저 정리하세요." };

    await admin.from("study_offerings").delete().eq("university_id", universityId).eq("department_id", sd.department_id).eq("status", "draft");
    await admin.from("study_admission_form_files").update({ is_current: false }).eq("spec_department_id", sdId).eq("is_current", true);
    const { error } = await admin.from("study_spec_departments").delete().eq("id", sdId);
    if (error) return { ok: false, error: `삭제 실패: ${error.message}` };

    const cacheErr = await refreshSpecLegacyCaches(admin, specId);
    if (cacheErr) return { ok: false, error: cacheErr };
    revalidate(specId, universityId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 가져오기 — 다른 학과(같은 요강 또는 다른 대학 요강)의 설정을 이 학과로 복사 */
export async function copyDepartmentSetupAction(specId: string, toSdId: string, fromSdId: string, what: CopyWhat): Promise<DeptResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    if (toSdId === fromSdId) return { ok: false, error: "같은 학과입니다." };
    const admin = createAdminClient();
    const [{ data: to }, { data: from }] = await Promise.all([
      admin.from("study_spec_departments").select("id, spec_id, study_admission_specs(university_id)").eq("id", toSdId).maybeSingle(),
      admin.from("study_spec_departments").select("id, spec_id").eq("id", fromSdId).maybeSingle(),
    ]);
    if (!to || to.spec_id !== specId) return { ok: false, error: "대상 학과를 찾을 수 없습니다." };
    if (!from) return { ok: false, error: "원본 학과를 찾을 수 없습니다." };
    const universityId = (to.study_admission_specs as unknown as { university_id: number } | null)?.university_id;
    if (!universityId) return { ok: false, error: "대학을 찾을 수 없습니다." };
    const err = await copyDepartmentSetup(admin, { id: from.id, spec_id: from.spec_id }, { id: to.id, spec_id: specId, university_id: universityId }, what);
    if (err) return { ok: false, error: err };
    const cacheErr = await refreshSpecLegacyCaches(admin, specId);
    if (cacheErr) return { ok: false, error: cacheErr };
    revalidate(specId, universityId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 학과 추가 — 기존 학과 마스터를 고르거나 새 이름으로 마스터를 만든다(active=false, course=direct).
 *   원하면 다른 학과 설정을 복사해 시작한다.
 */
export async function addSpecDepartmentAction(
  specId: string,
  input: { department_id?: number | null; new_name?: string | null; copy_from?: { sdId: string; what: CopyWhat } | null }
): Promise<DeptResult> {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const admin = createAdminClient();
    const { data: spec } = await admin.from("study_admission_specs").select("id, university_id").eq("id", specId).maybeSingle();
    if (!spec) return { ok: false, error: "모집요강을 찾을 수 없습니다." };

    let departmentId = input.department_id ?? null;
    if (!departmentId) {
      const name = String(input.new_name ?? "").trim();
      if (!name) return { ok: false, error: "학과 마스터를 고르거나 새 학과 이름을 입력하세요." };
      // 이미 같은 이름이 있으면 그것을 쓴다 (마스터 중복 방지)
      const { data: masters } = await admin.from("departments").select("id, name_ko, sort_order").eq("university_id", spec.university_id);
      const same = (masters ?? []).find((m) => normDeptName(m.name_ko) === normDeptName(name));
      if (same) departmentId = same.id;
      else {
        const maxSort = (masters ?? []).reduce((m, d) => Math.max(m, d.sort_order ?? 0), 0);
        const { data: created, error } = await admin
          .from("departments")
          .insert({ university_id: spec.university_id, name_ko: name, course: "direct", active: false, sort_order: maxSort + 10 })
          .select("id")
          .single();
        if (error || !created) return { ok: false, error: `학과 마스터 생성 실패: ${error?.message ?? "unknown"}` };
        departmentId = created.id;
        revalidatePath("/departments");
      }
    } else {
      const { data: master } = await admin.from("departments").select("id, university_id").eq("id", departmentId).maybeSingle();
      if (!master || master.university_id !== spec.university_id) return { ok: false, error: "이 대학의 학과가 아닙니다." };
    }

    const { data: dup } = await admin.from("study_spec_departments").select("id").eq("spec_id", specId).eq("department_id", departmentId).maybeSingle();
    if (dup) return { ok: false, error: "이미 이 요강에 있는 학과입니다." };

    const { data: last } = await admin.from("study_spec_departments").select("sort_order").eq("spec_id", specId).order("sort_order", { ascending: false }).limit(1);
    const sortOrder = (last?.[0]?.sort_order ?? 0) + 10;
    const { data: created, error } = await admin
      .from("study_spec_departments")
      .insert({ spec_id: specId, department_id: departmentId, kind: "regular", info: { program_kind: "degree" }, tuition: {}, scholarships: [], eligibility: null, sort_order: sortOrder })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: `학과 추가 실패: ${error?.message ?? "unknown"}` };

    if (input.copy_from?.sdId) {
      const { data: from } = await admin.from("study_spec_departments").select("id, spec_id").eq("id", input.copy_from.sdId).maybeSingle();
      if (from) {
        const err = await copyDepartmentSetup(admin, { id: from.id, spec_id: from.spec_id }, { id: created.id, spec_id: specId, university_id: spec.university_id }, input.copy_from.what);
        if (err) return { ok: false, error: `학과는 추가됐지만 복사에 실패했습니다: ${err}` };
      }
    }

    const cacheErr = await refreshSpecLegacyCaches(admin, specId);
    if (cacheErr) return { ok: false, error: cacheErr };
    revalidate(specId, spec.university_id);
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
