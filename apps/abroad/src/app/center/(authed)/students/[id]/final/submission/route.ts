/**
 * GET /center/students/[id]/final/submission?sub=<submissionId>&app=<applicationId>
 *   학생이 업로드한 제출서류 파일을 규칙 파일명으로 리네임해 다운로드.
 *   파일명: 서류명_이름(영대)_대학_학과_학기.원래확장자
 */

import { type NextRequest } from "next/server";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import {
  createServiceClient,
  STUDENT_FILES_BUCKET,
} from "@/lib/supabase/service";
import { finalDocFileName } from "@/lib/admission/build-form-sheet";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyCenterSession();
  const { id } = await params;
  const submissionId = req.nextUrl.searchParams.get("sub") ?? "";
  const appId = req.nextUrl.searchParams.get("app") ?? "";
  const supabase = await createCenterClient();

  const [{ data: student }, { data: fileRow }, { data: sub }, { data: app }] =
    await Promise.all([
      supabase.from("study_managed_students").select("id, name").eq("id", id).maybeSingle(),
      supabase
        .from("study_student_submission_files")
        .select("file_path, file_name")
        .eq("student_id", id)
        .eq("submission_id", submissionId)
        .maybeSingle(),
      supabase.from("study_required_submissions").select("id, name_ko").eq("id", submissionId).maybeSingle(),
      appId
        ? supabase
            .from("study_applications")
            .select("id, admission_spec_id, target_department_label")
            .eq("id", appId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (!student || !fileRow || !sub) return new Response("Not Found", { status: 404 });
  // 경로 org 검증
  if (!fileRow.file_path.startsWith(`${session.org.id}/`))
    return new Response("Forbidden", { status: 403 });

  const { data: spec } = app
    ? await supabase
        .from("study_admission_specs")
        .select("id, university_id, term")
        .eq("id", app.admission_spec_id)
        .maybeSingle()
    : { data: null };
  const { data: uni } = spec
    ? await supabase
        .from("universities")
        .select("name_ko")
        .eq("id", spec.university_id)
        .maybeSingle()
    : { data: null as { name_ko: string } | null };

  // 비공개 버킷에서 파일 다운로드 (service-role)
  const svc = createServiceClient();
  const { data: blob, error } = await svc.storage
    .from(STUDENT_FILES_BUCKET)
    .download(fileRow.file_path);
  if (error || !blob) return new Response("File error", { status: 500 });

  const ext = fileRow.file_name.includes(".")
    ? fileRow.file_name.split(".").pop() || "bin"
    : "bin";
  const fileName = finalDocFileName({
    docName: sub.name_ko,
    studentName: student.name,
    universityNameKo: uni?.name_ko ?? "",
    departmentName: app?.target_department_label ?? null,
    term: spec?.term ?? "",
    ext,
  });
  const encoded = encodeURIComponent(fileName);

  const buffer = Buffer.from(await blob.arrayBuffer());
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="submission.${ext}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}
