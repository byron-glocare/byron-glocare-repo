"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

const emptyToUndef = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), s);

const updateSchema = z.object({
  target_department_label: z
    .string()
    .min(1, "Vui lòng nhập ngành học")
    .max(200),
  next_action: emptyToUndef(z.string().max(200).optional()),
  next_deadline: emptyToUndef(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  ),
});

export type UpdateApplicationState =
  | {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | undefined;

export async function updateApplicationAction(
  applicationId: string,
  studentId: string,
  _prev: UpdateApplicationState,
  formData: FormData
): Promise<UpdateApplicationState> {
  await verifyCenterSession();

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;
  const supabase = await createCenterClient();

  const { error } = await supabase
    .from("study_applications")
    .update({
      target_department_label: d.target_department_label,
      next_action: d.next_action ?? null,
      next_deadline: d.next_deadline ?? null,
    })
    .eq("id", applicationId);

  if (error) {
    return { error: `Lỗi cập nhật: ${error.message}` };
  }

  revalidatePath(`/center/students/${studentId}`);
  redirect(`/center/students/${studentId}`);
}
