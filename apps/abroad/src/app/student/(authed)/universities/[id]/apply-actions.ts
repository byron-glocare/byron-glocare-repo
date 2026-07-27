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
  // 협약(offering) 경로면 채워짐. 자유 지원(모집요강 직접) 경로면 없음.
  offering_id: emptyToUndef(z.string().uuid().optional()),
  admission_spec_id: z.string().uuid(),
  // offering 경로에서만 실제 학과 FK. spec 직접 경로는 라벨만.
  target_department_id: emptyToUndef(
    z.coerce.number().int().positive().optional()
  ),
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

  // 중복 지원 방지: offering 경로는 offering 기준, spec 직접 경로는 (모집요강+학과) 기준
  let dupQuery = supabase
    .from("study_applications")
    .select("id")
    .eq("student_id", session.student.id);
  if (data.offering_id) {
    dupQuery = dupQuery.eq("offering_id", data.offering_id);
  } else {
    dupQuery = dupQuery
      .eq("admission_spec_id", data.admission_spec_id)
      .eq("target_department_label", data.target_department_label);
  }
  const { data: dup } = await dupQuery.maybeSingle();
  if (dup) {
    redirect(`/student/universities/${data.university_id}?applied=1`);
  }

  const { error } = await supabase.from("study_applications").insert({
    student_id: session.student.id,
    admission_spec_id: data.admission_spec_id,
    offering_id: data.offering_id ?? null,
    selected_language: data.selected_language ?? null,
    target_department_id: data.target_department_id ?? null,
    target_department_label: data.target_department_label,
    status: "preparing",
  });

  if (error) {
    return { error: `지원 등록 실패: ${error.message}` };
  }

  revalidatePath(`/student/universities/${data.university_id}`);
  redirect(`/student/universities/${data.university_id}?applied=1`);
}
