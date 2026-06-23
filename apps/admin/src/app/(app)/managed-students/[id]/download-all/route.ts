import { NextResponse } from "next/server";
import JSZip from "jszip";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

const STUDENT_FILES_BUCKET = "student-files";

/** 경로/폴더 안전 문자열 */
function safe(s: string): string {
  return s.replace(/[^\w.\-가-힣]+/g, "_").slice(0, 80);
}

/**
 * GET /managed-students/[id]/download-all
 *   학생이 업로드한 모든 제출서류를 zip 으로 묶어 한 번에 다운로드.
 *   (route handler 는 (app) layout 게이트를 안 거치므로 여기서 직접 권한 확인)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("study_managed_students")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!student) return new NextResponse("Not found", { status: 404 });

  const { data: files } = await admin
    .from("study_student_submission_files")
    .select("doc_key, file_path, file_name")
    .eq("student_id", id)
    .order("created_at", { ascending: true });

  if (!files || files.length === 0) {
    return new NextResponse("서류 없음", { status: 404 });
  }

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;

  for (const f of files) {
    const { data: blob, error } = await admin.storage
      .from(STUDENT_FILES_BUCKET)
      .download(f.file_path);
    if (error || !blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());

    let entry = f.doc_key
      ? `${safe(f.doc_key)}/${f.file_name}`
      : f.file_name;
    // 파일명 중복 방지
    if (used.has(entry)) {
      const dot = entry.lastIndexOf(".");
      const base = dot > 0 ? entry.slice(0, dot) : entry;
      const ext = dot > 0 ? entry.slice(dot) : "";
      let i = 2;
      while (used.has(`${base}(${i})${ext}`)) i++;
      entry = `${base}(${i})${ext}`;
    }
    used.add(entry);
    zip.file(entry, buf);
    added++;
  }

  if (added === 0) {
    return new NextResponse("파일을 가져오지 못했습니다.", { status: 502 });
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  const fname = encodeURIComponent(`${student.name}_제출서류.zip`);

  return new NextResponse(out as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${fname}`,
      "Cache-Control": "no-store",
    },
  });
}
