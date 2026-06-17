"use server";

import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database";

export type PublicSaveResult = { ok: true } | { ok: false; error: string };

/** 토큰 → 유효하면 student_id 반환 (만료/취소/없음이면 null) */
async function resolveStudentId(token: string): Promise<string | null> {
  if (!token) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from("study_student_fill_links")
    .select("student_id, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.student_id;
}

/** 공개 링크에서 정보입력 단일 항목 저장 (blur 자동저장용) */
export async function savePublicValueAction(input: {
  token: string;
  dataTypeKey: string;
  value: Json | null;
}): Promise<PublicSaveResult> {
  const studentId = await resolveStudentId(input.token);
  if (!studentId) return { ok: false, error: "EXPIRED" };

  const svc = createServiceClient();
  const empty =
    input.value === null ||
    input.value === undefined ||
    input.value === "" ||
    (Array.isArray(input.value) && input.value.length === 0);

  if (empty) {
    const { error } = await svc
      .from("study_student_data_values")
      .delete()
      .eq("student_id", studentId)
      .eq("data_type_key", input.dataTypeKey);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await svc.from("study_student_data_values").upsert(
      {
        student_id: studentId,
        data_type_key: input.dataTypeKey,
        value: input.value,
      },
      { onConflict: "student_id,data_type_key" }
    );
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** 임시저장 버튼 — 현재 값 일괄 저장 */
export async function savePublicAllAction(input: {
  token: string;
  values: Record<string, Json | null>;
}): Promise<PublicSaveResult> {
  const studentId = await resolveStudentId(input.token);
  if (!studentId) return { ok: false, error: "EXPIRED" };

  const svc = createServiceClient();
  const rows: Array<{ student_id: string; data_type_key: string; value: Json }> =
    [];
  const deletes: string[] = [];
  for (const [key, v] of Object.entries(input.values)) {
    const empty =
      v === null ||
      v === undefined ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (empty) deletes.push(key);
    else rows.push({ student_id: studentId, data_type_key: key, value: v });
  }

  if (rows.length > 0) {
    const { error } = await svc
      .from("study_student_data_values")
      .upsert(rows, { onConflict: "student_id,data_type_key" });
    if (error) return { ok: false, error: error.message };
  }
  if (deletes.length > 0) {
    const { error } = await svc
      .from("study_student_data_values")
      .delete()
      .eq("student_id", studentId)
      .in("data_type_key", deletes);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
