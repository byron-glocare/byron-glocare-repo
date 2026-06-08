"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * 모집요강 삭제.
 *   - 연결된 학생 지원(study_applications)이 있으면 데이터 보호를 위해 삭제 대신
 *     보관(archived) 처리.
 *   - 없으면 완전 삭제. (source_spec_id 참조는 ON DELETE SET NULL 로 안전)
 */
export async function deleteSpecAction(
  specId: string,
  universityId: number
): Promise<void> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();

  // 완전 삭제 시도. 연결된 지원(study_applications FK) 등으로 막히면 보관 처리로 대체.
  const { error } = await admin
    .from("study_admission_specs")
    .delete()
    .eq("id", specId);
  if (error) {
    await admin
      .from("study_admission_specs")
      .update({ status: "archived" })
      .eq("id", specId);
  }

  revalidatePath("/admissions");
  revalidatePath(`/admissions/${universityId}`);
  redirect(`/admissions/${universityId}`);
}
