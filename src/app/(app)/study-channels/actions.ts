"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/require-auth";
import {
  studyChannelSchema,
  type StudyChannelInput,
} from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createStudyChannel(
  input: StudyChannelInput
): Promise<ActionResult<{ id: number }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyChannelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("study_channels")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-channels");
  return { ok: true, data: { id: data.id as number } };
}

export async function updateStudyChannel(
  id: number,
  input: StudyChannelInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyChannelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("study_channels")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-channels");
  revalidatePath(`/study-channels/${id}`);
  return { ok: true, data: null };
}

export async function deleteStudyChannel(id: number): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("study_channels")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-channels");
  redirect("/study-channels");
}
