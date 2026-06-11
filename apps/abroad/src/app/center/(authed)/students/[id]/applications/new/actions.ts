"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

const emptyToUndef = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), s);

const createApplicationSchema = z.object({
  admission_spec_id: z.string().uuid("Chọn hồ sơ tuyển sinh hợp lệ"),
  // 모집(offering) 경로 — 희망 = 대학/학과/학기. 모집요강 직접 선택 시엔 없음.
  offering_id: emptyToUndef(z.string().uuid().optional()),
  // 실제 학과 FK (offering 경로면 채워짐)
  target_department_id: emptyToUndef(z.coerce.number().int().positive().optional()),
  // C2 — 선택 언어 (offering 경로). 거주지는 학생 속성(location)을 그대로 사용.
  selected_language: emptyToUndef(
    z.enum(["korean", "english", "other"]).optional()
  ),
  target_department_label: z
    .string()
    .min(1, "Chọn ngành học")
    .max(200),
  next_action: emptyToUndef(z.string().max(200).optional()),
  next_deadline: emptyToUndef(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  ),
});

export type CreateApplicationState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | undefined;

export async function createApplicationAction(
  studentId: string,
  _prev: CreateApplicationState,
  formData: FormData
): Promise<CreateApplicationState> {
  await verifyCenterSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = createApplicationSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const supabase = await createCenterClient();

  // RLS 가 본인 org 학생 만 INSERT 허용 (study_applications.student_id → study_managed_students.org_id)
  const { error } = await supabase.from("study_applications").insert({
    student_id: studentId,
    admission_spec_id: data.admission_spec_id,
    offering_id: data.offering_id ?? null,
    selected_language: data.selected_language ?? null,
    target_department_id: data.target_department_id ?? null,
    target_department_label: data.target_department_label,
    status: "preparing",
    next_action: data.next_action ?? null,
    next_deadline: data.next_deadline ?? null,
  });

  if (error) {
    return { error: `Lỗi đăng ký nguyện vọng: ${error.message}` };
  }

  revalidatePath(`/center/students/${studentId}`);
  redirect(`/center/students/${studentId}`);
}
