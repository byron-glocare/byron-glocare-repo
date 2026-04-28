"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/require-auth";
import {
  studyCenterSchema,
  type StudyCenterInput,
} from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createStudyCenter(
  input: StudyCenterInput
): Promise<ActionResult<{ id: number }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyCenterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("study_centers")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-centers");
  return { ok: true, data: { id: data.id as number } };
}

export async function updateStudyCenter(
  id: number,
  input: StudyCenterInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyCenterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("study_centers")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-centers");
  revalidatePath(`/study-centers/${id}`);
  return { ok: true, data: null };
}

export async function deleteStudyCenter(id: number): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("study_centers")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-centers");
  redirect("/study-centers");
}
