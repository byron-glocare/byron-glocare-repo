"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/require-auth";
import { createAdminClient } from "@/lib/supabase/server";
import {
  studyCaseSchema,
  type StudyCaseInput,
} from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createStudyCase(
  input: StudyCaseInput
): Promise<ActionResult<{ id: number }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("study_cases")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-cases");
  return { ok: true, data: { id: data.id as number } };
}

export async function updateStudyCase(
  id: number,
  input: StudyCaseInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = studyCaseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("study_cases")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-cases");
  revalidatePath(`/study-cases/${id}`);
  return { ok: true, data: null };
}

export async function deleteStudyCase(
  id: number
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("study_cases")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/study-cases");
  redirect("/study-cases");
}

/**
 * 사례 썸네일 이미지 — 브라우저가 저장소로 바로 올릴 서명 주소.
 *   TikTok 이 썸네일 자동 추출을 막아(2026-11) 캡처 이미지를 직접 올린다. 공개 버킷(양식 파일과 같은 곳)의 case-thumbs/.
 *   돌려준 publicUrl 을 tiktok_thumb 에 넣고 저장하면 홈페이지에 보인다.
 */
export async function createCaseThumbUploadUrl(
  fileName: string
): Promise<ActionResult<{ path: string; token: string; publicUrl: string }>> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const ext = /.(png|jpe?g|webp|gif)$/i.exec(fileName)?.[1]?.toLowerCase() ?? "jpg";
  const path = `case-thumbs/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("admission-form-files").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: `업로드 주소 발급 실패: ${error?.message ?? "unknown"}` };
  const { data: pub } = admin.storage.from("admission-form-files").getPublicUrl(path);
  return { ok: true, data: { path: data.path, token: data.token, publicUrl: pub.publicUrl } };
}
