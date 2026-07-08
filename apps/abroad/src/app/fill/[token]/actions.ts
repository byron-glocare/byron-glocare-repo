"use server";

import { createServiceClient, STUDENT_FILES_BUCKET } from "@/lib/supabase/service";
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

// ─── 공개 링크 서명(signature) ─────────────────────────────────────────────
//   학생이 링크에서 직접 서명 → PNG dataURL 을 스토리지에 저장.
//   값 행 저장은 호출측 onCommit(→savePublicValueAction)이 {path,file_name} 으로 처리.

/** 서명 PNG(dataURL) 업로드 → { path, file_name } 반환 (값 저장은 별도). */
export async function uploadPublicSignatureAction(input: {
  token: string;
  dataTypeKey: string;
  dataUrl: string;
}): Promise<
  | { ok: true; value: { path: string; file_name: string } }
  | { ok: false; error: string }
> {
  const studentId = await resolveStudentId(input.token);
  if (!studentId) return { ok: false, error: "EXPIRED" };

  const m = input.dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!m) return { ok: false, error: "INVALID" };
  const buffer = Buffer.from(m[1], "base64");
  if (buffer.length === 0 || buffer.length > 2_000_000) {
    return { ok: false, error: "SIZE" };
  }

  const svc = createServiceClient();
  const { data: student } = await svc
    .from("study_managed_students")
    .select("org_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "NOT_FOUND" };

  const fileName = `signature-${input.dataTypeKey}.png`;
  const path = `${student.org_id}/${studentId}/${input.dataTypeKey}/${Date.now()}-${fileName}`;
  const { error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: false });
  if (error) return { ok: false, error: error.message };

  return { ok: true, value: { path, file_name: fileName } };
}

/** 서명 삭제 — 스토리지 파일 제거 + 값 행 삭제 (다시 서명용). */
export async function removePublicSignatureAction(input: {
  token: string;
  dataTypeKey: string;
}): Promise<PublicSaveResult> {
  const studentId = await resolveStudentId(input.token);
  if (!studentId) return { ok: false, error: "EXPIRED" };

  const svc = createServiceClient();
  const { data: row } = await svc
    .from("study_student_data_values")
    .select("value")
    .eq("student_id", studentId)
    .eq("data_type_key", input.dataTypeKey)
    .maybeSingle();
  const path =
    row && row.value && typeof row.value === "object" && !Array.isArray(row.value)
      ? (row.value as { path?: string }).path
      : null;
  if (path) await svc.storage.from(STUDENT_FILES_BUCKET).remove([path]);

  const { error } = await svc
    .from("study_student_data_values")
    .delete()
    .eq("student_id", studentId)
    .eq("data_type_key", input.dataTypeKey);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 서명 미리보기용 서명 URL (10분). path 가 이 학생 폴더인지 확인. */
export async function signedUrlPublicSignatureAction(input: {
  token: string;
  path: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const studentId = await resolveStudentId(input.token);
  if (!studentId) return { ok: false, error: "EXPIRED" };
  // path = {org}/{studentId}/{dataTypeKey}/...
  if (input.path.split("/")[1] !== studentId) {
    return { ok: false, error: "FORBIDDEN" };
  }
  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUrl(input.path, 60 * 10);
  if (error || !data) return { ok: false, error: error?.message ?? "ERR" };
  return { ok: true, url: data.signedUrl };
}
