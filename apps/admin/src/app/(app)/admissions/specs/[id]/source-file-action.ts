"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

/**
 * 모집요강 원본 파일 연결 — 올리기/교체.
 *   파일은 브라우저가 createAdmissionSourceUploadUrl 로 저장소에 직접 올리고, 여기서는 주소만 요강에 저장한다.
 *   AI 추출은 하지 않는다 — 요강에 입력된 정보는 그대로 둔다. 교체 전 파일은 지우지 않는다.
 */
export async function setSpecSourceFileAction(
  specId: string,
  publicUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user || !isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다" };

  // 우리 저장소의 원본 보관 경로만 받는다
  if (!/^https:\/\/[^/]+\/storage\/v1\/object\/public\/admission-form-files\/admission-sources\//.test(publicUrl)) {
    return { ok: false, error: "올바른 파일 주소가 아닙니다" };
  }

  const admin = createAdminClient();
  const { data: spec, error } = await admin
    .from("study_admission_specs")
    .update({ source_file_url: publicUrl })
    .eq("id", specId)
    .select("university_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!spec) return { ok: false, error: "모집요강을 찾지 못했습니다" };

  revalidatePath(`/admissions/specs/${specId}`);
  revalidatePath(`/admissions/${spec.university_id}`);
  return { ok: true };
}
