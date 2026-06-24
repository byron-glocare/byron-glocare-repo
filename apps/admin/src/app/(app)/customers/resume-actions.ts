"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireAuth } from "@/lib/require-auth";
import { polishResumeNarrative } from "@/lib/resume/polish";
import { resumeDraftDataSchema } from "@/lib/validators";

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

/**
 * AI 다듬기 재실행 — polished 결과가 마음에 안 들 때 관리자가 한 번 더 호출.
 * raw 는 그대로 두고 polished 만 갱신.
 */
export async function regenerateResumePolish(
  customerId: string,
  draftId: string
): Promise<ResumeActionResult<{ polished: string }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: draft, error: fetchErr } = await supabase
    .from("resume_drafts")
    .select("id, data")
    .eq("id", draftId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!draft) return { ok: false, error: "draft 를 찾을 수 없습니다." };

  const parsed = resumeDraftDataSchema.safeParse(draft.data);
  if (!parsed.success) {
    return { ok: false, error: "이력서 데이터 파싱 실패" };
  }

  const raw = parsed.data.narrative_raw.trim();
  if (raw.length < 20) {
    return { ok: false, error: "원본 자기소개가 너무 짧습니다." };
  }

  const r = await polishResumeNarrative({
    rawText: raw,
    studentName: parsed.data.name_kr || parsed.data.name_vi,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const { error } = await supabase
    .from("resume_drafts")
    .update({
      data: { ...parsed.data, narrative_polished: r.polished },
    })
    .eq("id", draft.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: { polished: r.polished } };
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
