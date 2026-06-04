"use server";

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import type { Json } from "@/types/database";

export type SaveDataValueResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 학생의 표준 데이터 단일 항목 upsert.
 *   - RLS 가 본인 org 학생만 허용
 *   - value 가 null → 해당 row 삭제 (입력 취소)
 */
export async function saveStudentDataValueAction(input: {
  studentId: string;
  dataTypeKey: string;
  value: Json | null;
}): Promise<SaveDataValueResult> {
  const session = await verifyCenterSession();
  const supabase = await createCenterClient();

  if (input.value === null || input.value === undefined || input.value === "") {
    // 삭제
    const { error } = await supabase
      .from("study_student_data_values")
      .delete()
      .eq("student_id", input.studentId)
      .eq("data_type_key", input.dataTypeKey);
    if (error) return { ok: false, error: error.message };
  } else {
    // upsert
    const { error } = await supabase
      .from("study_student_data_values")
      .upsert(
        {
          student_id: input.studentId,
          data_type_key: input.dataTypeKey,
          value: input.value,
          filled_by: session.authUserId,
        },
        { onConflict: "student_id,data_type_key" }
      );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/center/students/${input.studentId}/data`);
  return { ok: true };
}
