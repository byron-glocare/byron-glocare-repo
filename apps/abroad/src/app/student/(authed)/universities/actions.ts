"use server";

import { z } from "zod";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  university_name: z
    .string()
    .trim()
    .min(2, "대학 이름을 입력하세요")
    .max(200),
  university_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type RequestUniversityState =
  | { ok: true }
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

/** 미등록 대학 추가 요청 (study_university_requests). 글로케어가 검토 후 편입. */
export async function requestUniversityAction(
  _prev: RequestUniversityState,
  formData: FormData
): Promise<RequestUniversityState> {
  const session = await verifyStudentSession();

  const parsed = requestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // RLS(sur_self): requested_by = auth.uid() 인 행만 insert 허용
  const supabase = await createClient();
  const { error } = await supabase.from("study_university_requests").insert({
    student_id: session.student.id,
    requested_by: session.authUserId,
    university_name: data.university_name,
    university_url: data.university_url ? data.university_url : null,
    note: data.note ? data.note : null,
    status: "pending",
  });

  if (error) {
    return { error: `요청 등록 실패: ${error.message}` };
  }
  return { ok: true };
}
