"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

/**
 * 학생 삭제.
 *   - RLS 가 본인 org 학생만 delete 허용
 *   - cascade: study_applications → study_application_documents / study_review_feedback / study_timelines (B1_schema.sql)
 *   - 삭제 후 학생 목록 redirect
 */
export async function deleteStudentAction(studentId: string) {
  await verifyCenterSession();
  const supabase = await createCenterClient();

  await supabase.from("study_managed_students").delete().eq("id", studentId);

  revalidatePath("/center/students");
  redirect("/center/students");
}
