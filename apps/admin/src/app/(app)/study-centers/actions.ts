"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/require-auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
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

/**
 * 유학센터 정산 설정 저장 — 연결된 study_center_orgs(1:1 백킹)를 찾거나
 * 없으면 생성한 뒤 정산 플랜·통화·상태를 갱신한다.
 */
export async function saveStudyCenterSettlement(
  studyCenterId: number,
  input: {
    pricingPlanId: string | null;
    currency: "KRW" | "USD" | "VND";
    status: "pending" | "active" | "suspended" | "closed";
  }
): Promise<ActionResult> {
  // 권한 게이트 (service_role 사용 전 필수)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user))
    return { ok: false, error: "권한이 없습니다." };

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("study_center_orgs")
    .select("id, status, activated_at")
    .eq("study_center_id", studyCenterId)
    .limit(1)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (org?.id) {
    const patch: {
      pricing_plan_id: string | null;
      settlement_currency: "KRW" | "USD" | "VND";
      status: "pending" | "active" | "suspended" | "closed";
      activated_at?: string;
    } = {
      pricing_plan_id: input.pricingPlanId,
      settlement_currency: input.currency,
      status: input.status,
    };
    if (input.status === "active" && org.status !== "active" && !org.activated_at)
      patch.activated_at = nowIso;
    const { error } = await admin
      .from("study_center_orgs")
      .update(patch)
      .eq("id", org.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: center } = await admin
      .from("study_centers")
      .select("name_vi, name_ko")
      .eq("id", studyCenterId)
      .maybeSingle();
    if (!center) return { ok: false, error: "유학센터를 찾을 수 없습니다." };
    const { error } = await admin.from("study_center_orgs").insert({
      name_vi: center.name_vi,
      name_ko: center.name_ko,
      country: "VN",
      status: input.status,
      settlement_currency: input.currency,
      pricing_plan_id: input.pricingPlanId,
      study_center_id: studyCenterId,
      activated_at: input.status === "active" ? nowIso : null,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/study-centers/${studyCenterId}`);
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
