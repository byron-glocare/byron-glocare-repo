"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import {
  trainingCenterSchema,
  trainingClassSchema,
  type TrainingCenterInput,
  type TrainingClassInput,
} from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// 교육원 CRUD
// =============================================================================

export async function createTrainingCenter(input: TrainingCenterInput) {
  const parsed = trainingCenterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("training_centers")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/training-centers");
  redirect(`/training-centers/${data.id}`);
}

export async function updateTrainingCenter(
  id: string,
  input: TrainingCenterInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = trainingCenterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("training_centers")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/training-centers");
  revalidatePath(`/training-centers/${id}`);
  return { ok: true, data: null };
}

export async function deleteTrainingCenter(
  id: string
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  // 연결된 교육생이 있으면 차단
  const { count: customerCount } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("training_center_id", id);

  if ((customerCount ?? 0) > 0) {
    return {
      ok: false,
      error: `소속 교육생 ${customerCount}명이 있어 삭제할 수 없습니다. 먼저 매칭을 해제하세요.`,
    };
  }

  // 과거 소개비 레코드가 있어도 차단 (DB FK ON DELETE RESTRICT)
  const { count: commissionCount } = await supabase
    .from("commission_payments")
    .select("id", { count: "exact", head: true })
    .eq("training_center_id", id);

  if ((commissionCount ?? 0) > 0) {
    return {
      ok: false,
      error: `과거 소개비 정산 이력 ${commissionCount}건이 있어 삭제할 수 없습니다.`,
    };
  }

  const { error } = await supabase
    .from("training_centers")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/training-centers");
  redirect("/training-centers");
}

// =============================================================================
// 월별 개강 (training_classes) CRUD
// =============================================================================

export async function createTrainingClass(
  trainingCenterId: string,
  input: TrainingClassInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = trainingClassSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("training_classes")
    .insert({ ...parsed.data, training_center_id: trainingCenterId });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/training-centers/${trainingCenterId}`);
  return { ok: true, data: null };
}

export async function updateTrainingClass(
  classId: string,
  trainingCenterId: string,
  input: TrainingClassInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = trainingClassSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("training_classes")
    .update(parsed.data)
    .eq("id", classId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/training-centers/${trainingCenterId}`);
  return { ok: true, data: null };
}

export async function deleteTrainingClass(
  classId: string,
  trainingCenterId: string
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  // 이 강의에 매칭된 교육생이 있으면 차단
  const { count } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("training_class_id", classId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `이 강의에 매칭된 교육생 ${count}명이 있어 삭제할 수 없습니다.`,
    };
  }

  const { error } = await supabase
    .from("training_classes")
    .delete()
    .eq("id", classId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/training-centers/${trainingCenterId}`);
  return { ok: true, data: null };
}
