"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * docx 작성서류 양식의 라벨 매핑 저장.
 *   mapping: { 정규화라벨: std_key }  (값 "" = 채우지 않음)
 */
export async function saveDocxMappingAction(
  formFileId: string,
  mapping: Record<string, string>
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user))
    return { ok: false, error: "권한이 없습니다." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("study_admission_form_files")
    .update({ label_mapping: mapping })
    .eq("id", formFileId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admissions/forms/${formFileId}`);
  return { ok: true };
}
