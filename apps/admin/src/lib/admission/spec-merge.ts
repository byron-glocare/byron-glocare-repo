/**
 * 모집요강 = 대학당 1개 (0067) — 학과 마스터 찾기·만들기, 어학당 보장 등 승인/편집 공용 서버 로직.
 *
 *   학과 마스터 매칭 규칙은 0067b 와 같다:
 *     · 어학당: 이름에 어학/한국어/연수 가 있는 학과 (활성 우선, course=language 우선). 없으면 '한국어 어학연수' 생성.
 *     · 일반학과: 공백 무시·대소문자 무시로 같거나 서로 품는 이름 (활성 우선, 완전 일치 우선). 없으면 생성.
 *   자동 생성 학과는 active=false (학생 화면 비노출).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { DepartmentInfo } from "./spec-departments";

type Client = SupabaseClient<Database>;

export const LANGUAGE_DEPT_RE = /(어학|한국어|연수)/;
export const TERM_RE = /^\d{4}-(Spring|Summer|Fall|Winter|Year)$/;

export function normDeptName(s: string | null | undefined): string {
  return String(s ?? "").replace(/\s+/g, "").toLowerCase();
}

type MasterRow = { id: number; name_ko: string; active: boolean; course: string | null; sort_order: number };

async function loadMasters(admin: Client, universityId: number): Promise<MasterRow[]> {
  const { data } = await admin
    .from("departments")
    .select("id, name_ko, active, course, sort_order")
    .eq("university_id", universityId)
    .order("id");
  return (data ?? []) as MasterRow[];
}

/** 어학당용 학과 마스터 — 이름으로만 본다 (course 값은 믿지 않는다) */
export function pickLanguageMaster(masters: MasterRow[]): MasterRow | null {
  const cands = masters.filter((m) => LANGUAGE_DEPT_RE.test(m.name_ko));
  cands.sort((a, b) => Number(b.active) - Number(a.active) || Number(b.course === "language") - Number(a.course === "language") || a.id - b.id);
  return cands[0] ?? null;
}

/** 일반학과용 학과 마스터 — 같거나 서로 품는 이름 */
export function pickRegularMaster(masters: MasterRow[], name: string): MasterRow | null {
  const n = normDeptName(name);
  if (!n) return null;
  const cands = masters.filter((m) => {
    if (LANGUAGE_DEPT_RE.test(m.name_ko)) return false;
    const mn = normDeptName(m.name_ko);
    return mn === n || mn.includes(n) || n.includes(mn);
  });
  cands.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      Number(normDeptName(b.name_ko) === n) - Number(normDeptName(a.name_ko) === n) ||
      a.id - b.id
  );
  return cands[0] ?? null;
}

/** 학과 마스터를 찾고 없으면 만든다 (active=false) */
export async function findOrCreateDepartmentMaster(
  admin: Client,
  universityId: number,
  input: { language: true } | { language: false; name: string }
): Promise<{ ok: true; id: number; created: boolean } | { ok: false; error: string }> {
  const masters = await loadMasters(admin, universityId);
  const found = input.language ? pickLanguageMaster(masters) : pickRegularMaster(masters, input.name);
  if (found) return { ok: true, id: found.id, created: false };
  const maxSort = masters.reduce((m, d) => Math.max(m, d.sort_order ?? 0), 0);
  const { data, error } = await admin
    .from("departments")
    .insert(
      input.language
        ? { university_id: universityId, name_ko: "한국어 어학연수", course: "language", active: false, sort_order: 0 }
        : { university_id: universityId, name_ko: input.name.trim() || "학과", course: "direct", active: false, sort_order: maxSort + 10 }
    )
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `학과 마스터 생성 실패: ${error?.message ?? "unknown"}` };
  return { ok: true, id: data.id, created: true };
}

/** 요강에 어학당(kind=language)이 없으면 만든다. 돌려주는 값은 어학당 요강 학과 id. */
export async function ensureLanguageSpecDepartment(
  admin: Client,
  specId: string,
  universityId: number,
  seed?: { info?: DepartmentInfo; tuition?: unknown; scholarships?: unknown; eligibility?: unknown | null }
): Promise<{ ok: true; id: string; department_id: number; created: boolean } | { ok: false; error: string }> {
  const { data: existing } = await admin
    .from("study_spec_departments")
    .select("id, department_id")
    .eq("spec_id", specId)
    .eq("kind", "language")
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id, department_id: existing.department_id, created: false };
  const master = await findOrCreateDepartmentMaster(admin, universityId, { language: true });
  if (!master.ok) return master;
  const info: DepartmentInfo = { name: "한국어 어학연수", program_kind: "language", ...(seed?.info ?? {}) };
  const { data, error } = await admin
    .from("study_spec_departments")
    .insert({
      spec_id: specId,
      department_id: master.id,
      kind: "language",
      info,
      tuition: seed?.tuition ?? {},
      scholarships: seed?.scholarships ?? [],
      eligibility: seed?.eligibility ?? null,
      sort_order: 0,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `어학당 생성 실패: ${error?.message ?? "unknown"}` };
  return { ok: true, id: data.id, department_id: master.id, created: true };
}

/** 요강의 term(레거시 컬럼) = 학기 중 가장 늦은 것 */
export async function syncSpecLegacyTerm(admin: Client, specId: string): Promise<void> {
  const { data } = await admin.from("study_spec_terms").select("term").eq("spec_id", specId).order("term", { ascending: false }).limit(1);
  const latest = data?.[0]?.term;
  if (latest) await admin.from("study_admission_specs").update({ term: latest }).eq("id", specId);
}

/** (대학, 학과, 학기) 모집 행이 없으면 draft 로 만든다 */
export async function ensureDraftOffering(
  admin: Client,
  universityId: number,
  departmentId: number,
  term: string,
  specId: string,
  sortOrder = 0
): Promise<string | null> {
  const { data: existing } = await admin
    .from("study_offerings")
    .select("id")
    .eq("university_id", universityId)
    .eq("department_id", departmentId)
    .eq("term", term)
    .maybeSingle();
  if (existing) return null;
  const { error } = await admin.from("study_offerings").insert({
    university_id: universityId,
    department_id: departmentId,
    term,
    status: "draft",
    source_spec_id: specId,
    sort_order: sortOrder,
  });
  return error ? `모집 행 생성 실패: ${error.message}` : null;
}

/** 옛 일정 JSONB 의 날짜만 비운다 (차수 이름은 남긴다) — 새 학기 만들 때 */
export function blankSchedule(src: unknown): Record<string, unknown> {
  const s = (src && typeof src === "object" ? src : {}) as { rounds?: Array<{ name?: string }>; submission_method?: string };
  return {
    rounds: Array.isArray(s.rounds)
      ? s.rounds.map((r) => ({
          name: r?.name ?? "",
          application_open: null,
          application_close: null,
          document_submission_close: null,
          interview: null,
          result_announcement: null,
        }))
      : [],
    semester_start: null,
    semester_end: null,
    orientation: null,
    submission_method: s.submission_method,
  };
}
