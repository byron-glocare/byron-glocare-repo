"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";

export type FinalizeResult = { ok: true } | { ok: false; error: string };

/**
 * 작성서류 "확정" — 그 시점의 학생 데이터로 채운 PDF 를 1회 생성해
 * 비공개 버킷에 저장하고 study_student_final_docs 에 기록한다.
 *   - PDF 생성은 기존 /final/pdf 라우트를 그대로 재사용(서버측 자체 fetch + 쿠키 전달)
 *   - 재확정 시 같은 경로 덮어쓰기 + row 갱신
 */
export async function finalizeFormDocAction(input: {
  studentId: string;
  formFileId: string;
  appId: string;
  docName: string;
  engine?: "pdf" | "docx";
  inputs?: Record<string, string>;
}): Promise<FinalizeResult> {
  const engine = input.engine ?? "pdf";
  const ext = engine === "docx" ? "docx" : "pdf";
  const contentType =
    engine === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
  const session = await verifyCenterSession();

  const rls = await createCenterClient();
  const { data: student } = await rls
    .from("study_managed_students")
    .select("id, org_id, name")
    .eq("id", input.studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "권한이 없습니다." };

  // 1) 기존 PDF 라우트를 호출해 채운 PDF 생성 (쿠키 전달로 세션 유지)
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;
  const cookieHeader = (await cookies()).toString();
  const inputsParam =
    input.inputs && Object.keys(input.inputs).length > 0
      ? `&inputs=${encodeURIComponent(JSON.stringify(input.inputs))}`
      : "";
  const base = `${origin}/center/students/${input.studentId}/final`;
  const url =
    engine === "docx"
      ? `${base}/docx-fill?form=${input.formFileId}`
      : `${base}/pdf?form=${input.formFileId}&app=${input.appId}${inputsParam}`;

  let buf: Buffer;
  try {
    const res = await fetch(url, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `생성 실패: ${t || `HTTP ${res.status}`}` };
    }
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return {
      ok: false,
      error: `생성 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 2) 스토리지 저장 (재확정 시 덮어쓰기)
  const path = `${student.org_id}/${input.studentId}/final/${input.formFileId}_${input.appId}.${ext}`;
  const svc = createServiceClient();
  const { error: upErr } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .upload(path, buf, { contentType, upsert: true });
  if (upErr) return { ok: false, error: `저장 실패: ${upErr.message}` };

  // 3) DB 기록 (upsert)
  const fileName = `${input.docName}_${student.name}.${ext}`.replace(/\s+/g, "_");
  const { error: dbErr } = await rls.from("study_student_final_docs").upsert(
    {
      student_id: input.studentId,
      form_file_id: input.formFileId,
      application_id: input.appId,
      doc_name: input.docName,
      file_path: path,
      file_name: fileName,
      size_bytes: buf.length,
      finalized_by: session.authUserId,
      finalized_at: new Date().toISOString(),
    },
    { onConflict: "student_id,form_file_id,application_id" }
  );
  if (dbErr) return { ok: false, error: `기록 실패: ${dbErr.message}` };

  revalidatePath(`/center/students/${input.studentId}/final`);
  return { ok: true };
}

/** 확정본 다운로드용 서명 URL (10분) */
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
