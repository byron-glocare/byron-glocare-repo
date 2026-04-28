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
