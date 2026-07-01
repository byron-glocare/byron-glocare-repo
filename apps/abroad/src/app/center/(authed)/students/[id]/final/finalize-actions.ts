"use server";

import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";

export type FinalizeResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
/** 최종 제출본 허용 형식: 편집한 문서(docx/pdf) + 스캔 이미지 */
const ALLOWED_EXT = new Set([
  "pdf",
  "docx",
  "doc",
  "hwp",
  "hwpx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
]);

function validate(fileName: string, sizeBytes: number): string | null {
  if (!sizeBytes || sizeBytes <= 0) return "파일이 올바르지 않습니다.";
  if (sizeBytes > MAX_FILE_BYTES) return "파일이 너무 큽니다 (최대 20MB).";
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.has(ext))
    return "지원하지 않는 형식입니다. 문서(PDF·DOCX·HWP) 또는 이미지만 올릴 수 있습니다.";
  return null;
}

/**
 * 완성본 업로드 1단계 — 서명 업로드 URL 발급.
 *   초안을 사람이 서명·보정한 뒤 편집한 최종 파일을 올린다.
 *   Vercel 4.5MB 한계 → 브라우저가 이 토큰으로 Supabase 에 직접 업로드.
 */
export async function createFinalUploadAction(input: {
  studentId: string;
  formFileId: string;
  appId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<
  | { ok: true; bucket: string; path: string; token: string }
  | { ok: false; error: string }
> {
  const session = await verifyCenterSession();
  const invalid = validate(input.fileName, input.sizeBytes);
  if (invalid) return { ok: false, error: invalid };

  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", input.studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  const safeName = input.fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${session.org.id}/${input.studentId}/final/${input.formFileId}_${input.appId}/${Date.now()}-${safeName}`;

  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data)
    return { ok: false, error: error?.message ?? "업로드 URL 생성 실패." };
  return {
    ok: true,
    bucket: STUDENT_FILES_BUCKET,
    path: data.path,
    token: data.token,
  };
}

/**
 * 완성본 업로드 2단계 — 업로드 완료 후 DB 기록.
 *   study_student_final_docs 에 업로드한 완성본을 기록. 아직 최종 제출은 아님
 *   (submitted_at = NULL). 재업로드 시 이전 파일 제거 + 제출 상태 초기화.
 */
export async function recordFinalUploadAction(input: {
  studentId: string;
  formFileId: string;
  appId: string;
  docName: string;
  path: string;
  fileName: string;
  sizeBytes: number;
}): Promise<FinalizeResult> {
  const session = await verifyCenterSession();
  if (
    !input.path.startsWith(`${session.org.id}/${input.studentId}/final/`)
  )
    return { ok: false, error: "권한이 없습니다." };

  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id")
    .eq("id", input.studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  const { data: existing } = await rls
    .from("study_student_final_docs")
    .select("file_path")
    .eq("student_id", input.studentId)
    .eq("form_file_id", input.formFileId)
    .eq("application_id", input.appId)
    .maybeSingle();

  const { error: dbErr } = await rls.from("study_student_final_docs").upsert(
    {
      student_id: input.studentId,
      form_file_id: input.formFileId,
      application_id: input.appId,
      doc_name: input.docName,
      file_path: input.path,
      file_name: input.fileName,
      size_bytes: input.sizeBytes,
      finalized_by: session.authUserId,
      finalized_at: new Date().toISOString(),
      // 재업로드하면 최종 제출 상태를 해제 — 새 파일은 다시 제출해야 함
      submitted_at: null,
      submitted_by: null,
    },
    { onConflict: "student_id,form_file_id,application_id" }
  );
  const svc = createServiceClient();
  if (dbErr) {
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([input.path]);
    return { ok: false, error: `기록 실패: ${dbErr.message}` };
  }
  if (existing?.file_path && existing.file_path !== input.path)
    await svc.storage.from(STUDENT_FILES_BUCKET).remove([existing.file_path]);

  revalidatePath(`/center/students/${input.studentId}/final`);
  return { ok: true };
}

/** 최종 제출하기 — submitted_at 세팅 (완성본이 있어야 함). 어드민 노출 시작. */
export async function submitFinalDocAction(input: {
  studentId: string;
  formFileId: string;
  appId: string;
}): Promise<FinalizeResult> {
  const session = await verifyCenterSession();
  const rls = await createCenterClient();

  const { data: row } = await rls
    .from("study_student_final_docs")
    .select("id, file_path")
    .eq("student_id", input.studentId)
    .eq("form_file_id", input.formFileId)
    .eq("application_id", input.appId)
    .maybeSingle();
  if (!row?.file_path)
    return { ok: false, error: "먼저 완성본을 업로드해야 최종 제출할 수 있습니다." };

  const { error } = await rls
    .from("study_student_final_docs")
    .update({
      submitted_at: new Date().toISOString(),
      submitted_by: session.authUserId,
    })
    .eq("id", row.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/center/students/${input.studentId}/final`);
  return { ok: true };
}

/** 최종 제출 취소 — submitted_at 해제 (다시 준비중 상태). */
export async function unsubmitFinalDocAction(input: {
  studentId: string;
  formFileId: string;
  appId: string;
}): Promise<FinalizeResult> {
  await verifyCenterSession();
  const rls = await createCenterClient();
  const { error } = await rls
    .from("study_student_final_docs")
    .update({ submitted_at: null, submitted_by: null })
    .eq("student_id", input.studentId)
    .eq("form_file_id", input.formFileId)
    .eq("application_id", input.appId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/center/students/${input.studentId}/final`);
  return { ok: true };
}

/** 지원별 일괄 최종 제출 — 완성본이 올라온(=file_path 있는) 미제출 서류를 모두 제출. */
export async function submitAllForAppAction(input: {
  studentId: string;
  appId: string;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await verifyCenterSession();
  const rls = await createCenterClient();

  const { data: rows } = await rls
    .from("study_student_final_docs")
    .select("id, file_path, submitted_at")
    .eq("student_id", input.studentId)
    .eq("application_id", input.appId);

  const ready = (rows ?? []).filter((r) => r.file_path && !r.submitted_at);
  if (ready.length === 0)
    return { ok: false, error: "제출할 완성본이 없습니다. 먼저 완성본을 업로드하세요." };

  const now = new Date().toISOString();
  const { error } = await rls
    .from("study_student_final_docs")
    .update({ submitted_at: now, submitted_by: session.authUserId })
    .in(
      "id",
      ready.map((r) => r.id)
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/center/students/${input.studentId}/final`);
  return { ok: true, count: ready.length };
}

/** 완성본/제출본 다운로드용 서명 URL (10분) */
export async function getFinalDocSignedUrlAction(
  path: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await verifyCenterSession();
  if (!path.startsWith(`${session.org.id}/`))
    return { ok: false, error: "권한이 없습니다." };
  const svc = createServiceClient();
  const { data, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error || !data) return { ok: false, error: error?.message ?? "링크 오류" };
  return { ok: true, url: data.signedUrl };
}
