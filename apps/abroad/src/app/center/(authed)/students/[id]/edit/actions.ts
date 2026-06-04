"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { createStudentSchema } from "@/lib/center/students/schema";

export type UpdateStudentState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | undefined;

export async function updateStudentAction(
  studentId: string,
  _prevState: UpdateStudentState,
  formData: FormData
): Promise<UpdateStudentState> {
  await verifyCenterSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createStudentSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const supabase = await createCenterClient();

  // RLS 가 본인 org 학생만 update 허용 — id 만 매칭하면 안전
  const { error } = await supabase
    .from("study_managed_students")
    .update({
      name: data.name,
      dob: data.dob ?? null,
      passport_no_encrypted: data.passport_no ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      topik_level: data.topik_level ?? null,
      current_visa: data.current_visa ?? null,
      location: data.location ?? null,
      notes: data.notes ?? null,
    })
    .eq("id", studentId);

  if (error) {
    return { error: `Lỗi cập nhật: ${error.message}` };
  }

  revalidatePath("/center/students");
  revalidatePath(`/center/students/${studentId}`);
  redirect(`/center/students/${studentId}`);
}
