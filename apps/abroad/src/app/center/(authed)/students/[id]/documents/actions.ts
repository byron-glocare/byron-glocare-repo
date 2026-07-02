"use server";

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
/** 허용 형식: PDF + 이미지(휴대폰 HEIC 포함) */
const ALLOWED_EXT = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
]);

export type UploadSubmissionResult =
  | { ok: true }
  | { ok: false; error: string };

function validateUpload(
  studentId: string,
  docKey: string,
  fileName: string,
  sizeBytes: number
): string | null {
  if (!studentId || !docKey) return "정보가 부족합니다.";
  if (!sizeBytes || sizeBytes <= 0) return "파일이 올바르지 않습니다.";
  if (sizeBytes > MAX_FILE_BYTES) return "파일이 너무 큽니다 (최대 20MB).";
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.has(ext))
    return "지원하지 않는 형식입니다. PDF 또는 이미지(JPG·PNG·HEIC)만 올릴 수 있습니다.";
  return null;
}

/**
 * 제출서류 업로드 1단계 — 서명 업로드 URL 발급.
 *   Vercel 함수 본문 4.5MB 한계 때문에 파일을 서버로 보내지 않고,
 *   브라우저가 이 토큰으로 Supabase 에 **직접** 업로드한다.
 */
export async function createSubmissionUploadAction(input: {
  studentId: string;
  docKey: string;
  fileName: string;
  sizeBytes: number;
}): Promise<
  | { ok: true; bucket: string; path: string; token: string }
  | { ok: false; error: string }
> {
  const session = await verifyCenterSession();
  const { studentId, docKey, fileName, sizeBytes } = input;
  const invalid = validateUpload(studentId, docKey, fileName, sizeBytes);
  if (invalid) return { ok: false, error: invalid };

  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  const safeKey = docKey.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${session.org.id}/${studentId}/submissions/${safeKey}/${Date.now()}-${safeName}`;

  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data)
    return { ok: false, error: error?.message ?? "업로드 URL 생성 실패." };
  return { ok: true, bucket: STUDENT_FILES_BUCKET, path: data.path, token: data.token };
}

/**
 * 제출서류 업로드 2단계 — 직접 업로드 완료 후 DB 기록(교체 시 기존 파일 제거).
 */
export async function finalizeSubmissionUploadAction(input: {
  studentId: string;
  docKey: string;
  path: string;
  fileName: string;
  sizeBytes: number;
  mime: string | null;
}): Promise<UploadSubmissionResult> {
  const session = await verifyCenterSession();
  const { studentId, docKey, path, fileName, sizeBytes, mime } = input;
  if (!path.startsWith(`${session.org.id}/${studentId}/submissions/`))
    return { ok: false, error: "권한이 없습니다." };

  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  const { data: existing } = await rls
    .from("study_student_submission_files")
    .select("file_path")
    .eq("student_id", studentId)
    .eq("doc_key", docKey)
    .maybeSingle();

  const { error: dbErr } = await rls
    .from("study_student_submission_files")
    .upsert(
      {
        student_id: studentId,
        doc_key: docKey,
        file_path: path,
        file_name: fileName,
        size_bytes: sizeBytes,
        mime_type: mime,
        uploaded_by: session.authUserId,
      },
      { onConflict: "student_id,doc_key" }
    );
  const svc = createServiceClient();
  if (dbErr) {
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([path]);
    return { ok: false, error: dbErr.message };
  }
  if (existing?.file_path && existing.file_path !== path)
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([existing.file_path]);

  revalidatePath(`/center/students/${studentId}/documents`);
  return { ok: true };
}

/**
 * 다른 지원(대학)에 올려둔 같은 서류의 파일을 이 서류로 복사 등록.
 *   같은 표준 서류인데 대학별 세부요건(인증 등)이 달라 키가 분리된 경우,
 *   파일 자체는 같아도 무방할 수 있으므로 스토리지 복사 + 새 doc_key 로 기록.
 */
export async function importSubmissionFileAction(input: {
  studentId: string;
  fromDocKey: string;
  toDocKey: string;
}): Promise<UploadSubmissionResult> {
  const session = await verifyCenterSession();
  const { studentId, fromDocKey, toDocKey } = input;
  if (!studentId || !fromDocKey || !toDocKey || fromDocKey === toDocKey)
    return { ok: false, error: "정보가 부족합니다." };

  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  const { data: src } = await rls
    .from("study_student_submission_files")
    .select("file_path, file_name, size_bytes, mime_type")
    .eq("student_id", studentId)
    .eq("doc_key", fromDocKey)
    .maybeSingle();
  if (!src?.file_path)
    return { ok: false, error: "가져올 파일이 없습니다." };
  if (!src.file_path.startsWith(`${session.org.id}/`))
    return { ok: false, error: "권한이 없습니다." };

  const safeKey = toDocKey.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const safeName = src.file_name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const dest = `${session.org.id}/${studentId}/submissions/${safeKey}/${Date.now()}-${safeName}`;

  const svc = createServiceClient();
  const { error: cpErr } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .copy(src.file_path, dest);
  if (cpErr) return { ok: false, error: `파일 복사 실패: ${cpErr.message}` };

  const { data: existing } = await rls
    .from("study_student_submission_files")
    .select("file_path")
    .eq("student_id", studentId)
    .eq("doc_key", toDocKey)
    .maybeSingle();

  const { error: dbErr } = await rls
    .from("study_student_submission_files")
    .upsert(
      {
        student_id: studentId,
        doc_key: toDocKey,
        file_path: dest,
        file_name: src.file_name,
        size_bytes: src.size_bytes,
        mime_type: src.mime_type,
        uploaded_by: session.authUserId,
      },
      { onConflict: "student_id,doc_key" }
    );
  if (dbErr) {
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([dest]);
    return { ok: false, error: dbErr.message };
  }
  if (existing?.file_path && existing.file_path !== dest)
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([existing.file_path]);

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
