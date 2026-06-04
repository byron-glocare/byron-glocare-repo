"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/require-auth";
import {
  universitySchema,
  departmentSchema,
  type UniversityInput,
  type DepartmentInput,
} from "@/lib/validators";
import {
  ensureUniversityAndDepartments,
  type SpecDepartment,
} from "@/lib/admission/ensure-records";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// universities CRUD
// =============================================================================

export async function createUniversity(
  input: UniversityInput
): Promise<ActionResult<{ id: number }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = universitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("universities")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/universities");
  return { ok: true, data: { id: data.id as number } };
}

/**
 * Flow B: 대학 생성 시 첨부한 모집요강 추출 결과로 spec 등록 + 학과 자동 생성.
 *   - study_admission_specs INSERT (status='draft' — 운영자가 모집요강에서 검수/승인)
 *   - spec.departments 로 미등록 학과 active=false 자동 생성 (ensure-records 재사용)
 *   대학 생성 성공 직후 호출. 실패해도 대학 생성 자체는 막지 않음(호출부에서 경고).
 */
const SPEC_TERM_RE = /^\d{4}-(Spring|Fall|Summer|Winter|Year)$/;
const SPEC_PROGRAM_TYPES = [
  "language_program",
  "associate_2yr",
  "bachelor_3yr_extension",
  "bachelor_4yr",
] as const;
const SPEC_AREAS = [
  "departments",
  "required_documents",
  "eligibility",
  "schedule",
  "tuition",
  "scholarships",
  "metadata",
] as const;

export async function createSpecFromExtraction(input: {
  universityId: number;
  term: string;
  programType: string;
  admissionCategory?: string | null;
  sourceFileName?: string | null;
  spec: Record<string, unknown>;
  aiLog?: unknown;
}): Promise<ActionResult<{ id: string }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (!SPEC_TERM_RE.test(input.term)) {
    return { ok: false, error: "학기 형식이 올바르지 않습니다 (예: 2026-Spring)" };
  }
  if (!SPEC_PROGRAM_TYPES.includes(input.programType as (typeof SPEC_PROGRAM_TYPES)[number])) {
    return { ok: false, error: "과정(program_type)을 선택하세요" };
  }

  const areas: Record<string, unknown> = {};
  for (const a of SPEC_AREAS) {
    const v = (input.spec as Record<string, unknown>)[a];
    areas[a] =
      v ??
      (a === "departments" || a === "required_documents" || a === "scholarships"
        ? []
        : {});
  }

  const { data: inserted, error } = await supabase
    .from("study_admission_specs")
    .insert({
      university_id: input.universityId,
      term: input.term,
      admission_category: input.admissionCategory || null,
      program_type: input.programType as (typeof SPEC_PROGRAM_TYPES)[number],
      departments: areas.departments,
      required_documents: areas.required_documents,
      eligibility: areas.eligibility,
      schedule: areas.schedule,
      tuition: areas.tuition,
      scholarships: areas.scholarships,
      metadata: areas.metadata,
      source_file_url: input.sourceFileName || null,
      ai_extraction_log: input.aiLog ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "모집요강 저장 실패" };
  }

  // 학과 active=false 자동 생성 (실패해도 spec 은 유지)
  await ensureUniversityAndDepartments({
    universityId: input.universityId,
    programType: input.programType,
    departments: (areas.departments as SpecDepartment[]) ?? [],
  });

  revalidatePath("/admissions");
  revalidatePath("/departments");
  revalidatePath(`/universities/${input.universityId}`);
  return { ok: true, data: { id: inserted.id as string } };
}

export async function updateUniversity(
  id: number,
  input: UniversityInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = universitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("universities")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/universities");
  revalidatePath(`/universities/${id}`);
  return { ok: true, data: null };
}

export async function deleteUniversity(id: number): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  // 학과가 있으면 차단
  const { count } = await supabase
    .from("departments")
    .select("id", { count: "exact", head: true })
    .eq("university_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `소속 학과 ${count}개가 있어 삭제할 수 없습니다. 먼저 학과를 삭제하세요.`,
    };
  }

  const { error } = await supabase
    .from("universities")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/universities");
  redirect("/universities");
}

// =============================================================================
// departments CRUD
// =============================================================================

export async function createDepartment(
  input: DepartmentInput
): Promise<ActionResult<{ id: number }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("departments")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/departments");
  revalidatePath(`/universities/${parsed.data.university_id}`);
  return { ok: true, data: { id: data.id as number } };
}

export async function updateDepartment(
  id: number,
  input: DepartmentInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("departments")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/departments");
  revalidatePath(`/universities/${parsed.data.university_id}`);
  return { ok: true, data: null };
}

export async function deleteDepartment(id: number): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/departments");
  return { ok: true, data: null };
}
