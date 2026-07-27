"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

export type RequestActionResult = { ok: true } | { ok: false; error: string };

async function requireGlocareAdmin(): Promise<RequestActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

/**
 * 미등록 대학 요청 승인 → universities 에 대학 생성(자유 지원 카탈로그 노출) +
 * 요청을 added 로 마감. 이미 있는 대학과 연결하려면 existingUniversityId 전달.
 */
export async function approveUniversityRequestAction(input: {
  requestId: string;
  existingUniversityId?: number | null;
}): Promise<RequestActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("study_university_requests")
    .select("id, university_name, university_url, status")
    .eq("id", input.requestId)
    .maybeSingle();
  if (!req) return { ok: false, error: "요청을 찾을 수 없습니다." };
  if (req.status !== "pending")
    return { ok: false, error: "이미 처리된 요청입니다." };

  let universityId = input.existingUniversityId ?? null;
  if (!universityId) {
    const { data: created, error: cErr } = await admin
      .from("universities")
      .insert({
        name_ko: req.university_name,
        website_url: req.university_url,
        active: true,
      })
      .select("id")
      .single();
    if (cErr || !created)
      return { ok: false, error: `대학 생성 실패: ${cErr?.message}` };
    universityId = created.id;
  }

  const { error } = await admin
    .from("study_university_requests")
    .update({
      status: "added",
      resolved_university_id: universityId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.requestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/university-requests");
  return { ok: true };
}

/** 미등록 대학 요청 거절 */
export async function rejectUniversityRequestAction(
  requestId: string
): Promise<RequestActionResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_university_requests")
    .update({ status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/university-requests");
  return { ok: true };
}
