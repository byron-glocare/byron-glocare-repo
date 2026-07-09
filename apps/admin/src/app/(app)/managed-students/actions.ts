"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

export type ReassignResult = { ok: true } | { ok: false; error: string };

async function requireGlocareAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

/** study_center_id → org 를 찾고, 없으면 study_center 정보로 새 org 생성. (accounts 와 동일) */
async function resolveOrgForStudyCenter(
  admin: ReturnType<typeof createAdminClient>,
  studyCenterId: number
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  const { data: existing } = await admin
    .from("study_center_orgs")
    .select("id")
    .eq("study_center_id", studyCenterId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return { ok: true, orgId: existing.id };

  const { data: center } = await admin
    .from("study_centers")
    .select("name_vi, name_ko")
    .eq("id", studyCenterId)
    .maybeSingle();
  if (!center) return { ok: false, error: "유학센터를 찾을 수 없습니다." };

  const { data: org, error } = await admin
    .from("study_center_orgs")
    .insert({
      name_vi: center.name_vi,
      name_ko: center.name_ko,
      country: "VN",
      status: "active",
      settlement_currency: "KRW",
      study_center_id: studyCenterId,
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !org)
    return { ok: false, error: `회사(org) 생성 실패: ${error?.message}` };
  return { ok: true, orgId: org.id };
}

/**
 * 유학생의 소속 유학센터 변경 (재배정).
 *   글로케어 어드민 전용. 선택 센터의 org 를 찾거나 생성해 study_managed_students.org_id 갱신.
 */
export async function reassignStudentAction(
  studentId: string,
  studyCenterId: number
): Promise<ReassignResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;

  if (!studentId || !Number.isInteger(studyCenterId) || studyCenterId <= 0) {
    return { ok: false, error: "입력이 올바르지 않습니다." };
  }

  const admin = createAdminClient();
  const org = await resolveOrgForStudyCenter(admin, studyCenterId);
  if (!org.ok) return { ok: false, error: org.error };

  const { error } = await admin
    .from("study_managed_students")
    .update({ org_id: org.orgId })
    .eq("id", studentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/managed-students/${studentId}`);
  revalidatePath("/managed-students");
  return { ok: true };
}
