"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

export type TermCloseResult = { ok: true } | { ok: false; error: string };

/** 요강 학기 종료/되돌리기 — ids 하나면 대학 하나, 여러 개면 학기 일괄 */
export async function setTermsClosedAction(ids: string[], closed: boolean): Promise<TermCloseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  if (ids.length === 0) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_spec_terms")
    .update({ closed_at: closed ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/managed-students/terms");
  revalidatePath("/managed-students");
  revalidatePath("/");
  return { ok: true };
}
