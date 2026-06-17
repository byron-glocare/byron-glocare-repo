"use server";

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export type UploadSubmissionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 제출서류 파일 업로드 — 학생별 제출서류 슬롯.
 *   1. 세션 + 학생 org 검증(RLS)
 *   2. service-role 로 비공개 버킷 업로드 (org/student/submissions/submissionId/ts-name)
 *   3. study_student_submission_files upsert (student_id+submission_id 유일, 교체)
 */
export async function uploadSubmissionFileAction(
  formData: FormData
): Promise<UploadSubmissionResult> {
  const session = await verifyCenterSession();

  const studentId = String(formData.get("studentId") ?? "");
  const docKey = String(formData.get("docKey") ?? "");
  const file = formData.get("file");

  if (!studentId || !docKey)
    return { ok: false, error: "정보가 부족합니다." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "파일이 올바르지 않습니다." };
  if (file.size > MAX_FILE_BYTES)
    return { ok: false, error: "파일이 너무 큽니다 (최대 20MB)." };

  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  // 기존 파일 path (교체 시 삭제용)
  const { data: existing } = await rls
    .from("study_student_submission_files")
    .select("file_path")
    .eq("student_id", studentId)
    .eq("doc_key", docKey)
    .maybeSingle();

  // doc_key 를 경로 안전 문자열로
  const safeKey = docKey.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${session.org.id}/${studentId}/submissions/${safeKey}/${Date.now()}-${safeName}`;

  const svc = createServiceClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: dbErr } = await rls
    .from("study_student_submission_files")
    .upsert(
      {
        student_id: studentId,
        doc_key: docKey,
        file_path: path,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
        uploaded_by: session.authUserId,
      },
      { onConflict: "student_id,doc_key" }
    );
  if (dbErr) {
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([path]);
    return { ok: false, error: dbErr.message };
  }

  // 교체면 기존 파일 제거 (best-effort)
  if (existing?.file_path && existing.file_path !== path) {
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([existing.file_path]);
  }

  revalidatePath(`/center/students/${studentId}/documents`);
  return { ok: true };
}

/** 제출서류 파일 보기 (서명 URL 10분) */
export async function getSubmissionFileSignedUrlAction(
  path: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await verifyCenterSession();
  if (!path || !path.startsWith(`${session.org.id}/`))
    return { ok: false, error: "권한이 없습니다." };
  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error || !data)
    return { ok: false, error: error?.message ?? "링크 생성 실패." };
  return { ok: true, url: data.signedUrl };
}

/** 제출서류 파일 삭제 (파일 + row) */
export async function removeSubmissionFileAction(input: {
  studentId: string;
  docKey: string;
  path: string;
}): Promise<UploadSubmissionResult> {
  const session = await verifyCenterSession();
  if (!input.path.startsWith(`${session.org.id}/`))
    return { ok: false, error: "권한이 없습니다." };

  const svc = createServiceClient();
  await svc.storage.from(STUDENT_FILES_BUCKET).remove([input.path]);

  const rls = await createCenterClient();
  const { error } = await rls
    .from("study_student_submission_files")
    .delete()
    .eq("student_id", input.studentId)
    .eq("doc_key", input.docKey);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/center/students/${input.studentId}/documents`);
  return { ok: true };
}
