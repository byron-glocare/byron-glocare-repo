"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireAuth } from "@/lib/require-auth";

export type ResumeActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 학생에게 보낼 이력서 작성 링크 생성. 기존 미제출 draft 가 있으면
 * 그것의 token 을 갱신해서 7일 더 연장 (재발급).
 */
export async function createResumeDraft(
  customerId: string
): Promise<ResumeActionResult<{ token: string; expiresAt: string }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
  const token = randomUUID().replace(/-/g, "");

  // 기존 draft (미제출) 있으면 재발급, 없으면 새로 생성
  const { data: existing } = await supabase
    .from("resume_drafts")
    .select("id, submitted_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = existing?.[0];
  if (last && !last.submitted_at) {
    const { error } = await supabase
      .from("resume_drafts")
      .update({ token, expires_at: expiresAt })
      .eq("id", last.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("resume_drafts").insert({
      customer_id: customerId,
      token,
      expires_at: expiresAt,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: { token, expiresAt } };
}

/** 이력서 draft 폐기 — 다시 생성 가능 */
export async function deleteResumeDraft(
  customerId: string,
  draftId: string
): Promise<ResumeActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("resume_drafts")
    .delete()
    .eq("id", draftId)
    .eq("customer_id", customerId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}
