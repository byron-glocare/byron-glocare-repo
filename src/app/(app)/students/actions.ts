"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/require-auth";
import {
  studyInboxStatusSchema,
  type StudyInboxStatusInput,
} from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function updateStudyContactStatus(
  id: number,
  input: StudyInboxStatusInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyInboxStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("study_contacts")
    .update({ status: parsed.data.status, memo: parsed.data.memo })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  return { ok: true, data: null };
}

export async function updateStudyClaimStatus(
  id: number,
  input: StudyInboxStatusInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyInboxStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("study_insurance_claims")
    .update({ status: parsed.data.status, memo: parsed.data.memo })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  return { ok: true, data: null };
}
