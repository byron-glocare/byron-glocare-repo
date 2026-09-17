"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/require-auth";
import type { Json } from "@/types/database";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// system_settings 업데이트
// =============================================================================

export async function updateSystemSetting(
  key: string,
  value: Json
): Promise<ActionResult> {
  let user, supabase;
  try {
    ({ user, supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase.from("system_settings").upsert(
    {
      key,
      value,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, data: null };
}

/** 본인 비밀번호 변경 */
export async function updateOwnPassword(
  newPassword: string
): Promise<ActionResult> {
  if (newPassword.length < 6) {
    return { ok: false, error: "비밀번호는 6자 이상이어야 합니다." };
  }

  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
