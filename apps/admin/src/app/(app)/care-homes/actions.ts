"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { generateCode } from "@/lib/code-generator";
import { careHomeSchema, type CareHomeInput } from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createCareHome(input: CareHomeInput) {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }

  const parsed = careHomeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const code = await generateCode(supabase, "care_homes");

  const { data, error } = await supabase
    .from("care_homes")
    .insert({ ...parsed.data, code })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/care-homes");
  return { ok: true as const, data: { id: data.id as string } };
}

export async function updateCareHome(
  id: string,
  input: CareHomeInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = careHomeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("care_homes")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/care-homes");
  revalidatePath(`/care-homes/${id}`);
  return { ok: true, data: null };
}

export async function deleteCareHome(id: string): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { count } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("care_home_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `소속 교육생 ${count}명이 있어 삭제할 수 없습니다. 먼저 매칭을 해제하세요.`,
    };
  }

  const { error } = await supabase.from("care_homes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/care-homes");
  redirect("/care-homes");
}
