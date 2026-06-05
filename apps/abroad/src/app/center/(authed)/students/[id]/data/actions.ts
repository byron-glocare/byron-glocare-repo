"use server";

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";
import type { Json } from "@/types/database";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

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

export type UploadFileResult =
  | { ok: true; value: { path: string; file_name: string } }
  | { ok: false; error: string };

/**
 * 학생 첨부파일 업로드.
 *   1. 세션 + 이 학생이 본인 org 소속인지 검증 (RLS 클라이언트가 막아줌)
 *   2. service-role 로 비공개 버킷에 업로드 (경로 = org/student/key/타임스탬프-파일명)
 *   3. { path, file_name } 반환 → 호출측이 saveStudentDataValueAction 으로 값 저장
 *      (값 저장은 기존 흐름 재사용. 여기선 파일만 다룬다.)
 */
export async function uploadStudentFileAction(
  formData: FormData
): Promise<UploadFileResult> {
  const session = await verifyCenterSession();

  const studentId = String(formData.get("studentId") ?? "");
  const dataTypeKey = String(formData.get("dataTypeKey") ?? "");
  const file = formData.get("file");

  if (!studentId || !dataTypeKey) {
    return { ok: false, error: "Thiếu thông tin." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Tệp không hợp lệ." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "Tệp quá lớn (tối đa 20MB)." };
  }

  // 권한: 이 학생이 내 org 소속인지 — RLS 가 막아주므로 안 보이면 거부
  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) {
    return { ok: false, error: "Không có quyền với sinh viên này." };
  }

  // 검증 끝 → service-role 로 업로드 (Storage RLS 정책 불필요)
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${session.org.id}/${studentId}/${dataTypeKey}/${Date.now()}-${safeName}`;

  const svc = createServiceClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  return { ok: true, value: { path, file_name: file.name } };
}

/**
 * 업로드된 첨부파일을 잠깐 열어볼 수 있는 서명 URL (10분).
 *   path 가 본인 org 로 시작하는지 확인해 타 org 파일 접근 차단.
 */
export async function getStudentFileSignedUrlAction(
  path: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await verifyCenterSession();
  if (!path || !path.startsWith(`${session.org.id}/`)) {
    return { ok: false, error: "Không có quyền." };
  }
  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Không tạo được liên kết." };
  }
  return { ok: true, url: data.signedUrl };
}

/**
 * 첨부파일 제거 — 보관함의 실제 파일 삭제 + 데이터 값 비우기.
 */
export async function removeStudentFileAction(input: {
  studentId: string;
  dataTypeKey: string;
  path: string;
}): Promise<SaveDataValueResult> {
  const session = await verifyCenterSession();
  if (!input.path.startsWith(`${session.org.id}/`)) {
    return { ok: false, error: "Không có quyền." };
  }

  // 보관함 파일 삭제 (best-effort)
  const svc = createServiceClient();
  await svc.storage.from(STUDENT_FILES_BUCKET).remove([input.path]);

  // 데이터 값 삭제 (RLS — 본인 org 만)
  const rls = await createCenterClient();
  const { error } = await rls
    .from("study_student_data_values")
    .delete()
    .eq("student_id", input.studentId)
    .eq("data_type_key", input.dataTypeKey);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/center/students/${input.studentId}/data`);
  return { ok: true };
}
