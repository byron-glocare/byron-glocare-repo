"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";

const emptyToUndef = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), s);

const applySchema = z.object({
  university_id: z.coerce.number().int().positive(),
  offering_id: z.string().uuid(),
  admission_spec_id: z.string().uuid(),
  target_department_id: z.coerce.number().int().positive(),
  target_department_label: z.string().trim().min(1).max(200),
  selected_language: emptyToUndef(
    z.enum(["korean", "english", "other"]).optional()
  ),
});

export type ApplyState = { error?: string } | undefined;

/**
 * 셀프(B2C) 학생의 지원 생성.
 *   status = "preparing" (결제 없이 바로 서류 작성 단계로).
 *   RLS(sa_self_rw): study_is_my_student(student_id) 인 행만 insert 허용.
 */
export async function createSelfApplicationAction(
  _prev: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const session = await verifyStudentSession();

  const parsed = applySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "입력값을 확인해 주세요." };
  }
  const data = parsed.data;
  const supabase = await createClient();

  // 같은 offering 중복 지원 방지
  const { data: dup } = await supabase
    .from("study_applications")
    .select("id")
    .eq("student_id", session.student.id)
    .eq("offering_id", data.offering_id)
    .maybeSingle();
  if (dup) {
    redirect(`/student/universities/${data.university_id}?applied=1`);
  }

  const { error } = await supabase.from("study_applications").insert({
    student_id: session.student.id,
    admission_spec_id: data.admission_spec_id,
    offering_id: data.offering_id,
    selected_language: data.selected_language ?? null,
    target_department_id: data.target_department_id,
    target_department_label: data.target_department_label,
    status: "preparing",
  });

  if (error) {
    return { error: `지원 등록 실패: ${error.message}` };
  }

  revalidatePath(`/student/universities/${data.university_id}`);
  redirect(`/student/universities/${data.university_id}?applied=1`);
}
