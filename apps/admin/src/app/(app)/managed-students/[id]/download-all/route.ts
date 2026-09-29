import { NextResponse } from "next/server";
import JSZip from "jszip";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import {
  extOf,
  resolveDocKinds,
  submissionFileName,
} from "@/lib/admission/submission-file-naming";

const STUDENT_FILES_BUCKET = "student-files";

/**
 * GET /managed-students/[id]/download-all
 *   학생이 업로드한 모든 제출서류 + 최종 제출된 작성서류를 zip 으로 한 번에 다운로드.
 *
 *   zip 안에 폴더를 만들지 않는다 — 대학에 보낼 때 폴더를 헤집는 게 불편하다는 요청(2026-09-29).
 *   파일명은 업로드 원본이 아니라 규칙 이름(`서류명_이름_대학_학과_학기.확장자`)으로 바꿔 담는다.
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

  const [{ data: files }, { data: finals }] = await Promise.all([
    admin
      .from("study_student_submission_files")
      .select("doc_key, file_path, file_name")
      .eq("student_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("study_student_final_docs")
      .select("doc_name, file_path, file_name")
      .eq("student_id", id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: true }),
  ]);

  const [kinds, target] = await Promise.all([
    resolveDocKinds(admin, (files ?? []).map((f) => f.doc_key)),
    loadPrimaryTarget(admin, id),
  ]);

  // 파일명은 학생·지원 대학 기준으로 붙인다. 서류는 지원 대학끼리 공유되므로
  // 대표(1지망) 지원 1건을 기준으로 삼는다.
  const items = [
    ...(files ?? []).map((f) => ({
      path: f.file_path,
      name: submissionFileName({
        docLabel: f.doc_key ? kinds.get(f.doc_key)?.label ?? f.doc_key : "제출서류",
        studentName: student.name,
        universityNameKo: target.university,
        departmentName: target.department,
        term: target.term,
        ext: extOf(f.file_name),
      }),
    })),
    ...(finals ?? []).map((f) => ({
      path: f.file_path,
      name: submissionFileName({
        docLabel: f.doc_name || "작성서류",
        studentName: student.name,
        universityNameKo: target.university,
        departmentName: target.department,
        term: target.term,
        ext: extOf(f.file_name),
      }),
    })),
  ];

  if (items.length === 0) {
    return new NextResponse("서류 없음", { status: 404 });
  }

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;

  for (const f of items) {
    const { data: blob, error } = await admin.storage
      .from(STUDENT_FILES_BUCKET)
      .download(f.path);
    if (error || !blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());

    let entry = f.name;
    // 파일명 중복 방지 (같은 서류를 여러 장 올린 경우)
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

/** 파일명에 쓸 대표 지원(1지망 우선) 의 대학·학과·학기 */
async function loadPrimaryTarget(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string
): Promise<{ university: string | null; department: string | null; term: string | null }> {
  const empty = { university: null, department: null, term: null };
  const { data: apps } = await admin
    .from("study_applications")
    .select("admission_spec_id, target_department_label, priority, term, created_at")
    .eq("student_id", studentId)
    .order("priority", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);
  const app = apps?.[0];
  if (!app) return empty;

  const { data: spec } = app.admission_spec_id
    ? await admin
        .from("study_admission_specs")
        .select("university_id, term")
        .eq("id", app.admission_spec_id)
        .maybeSingle()
    : { data: null };
  const { data: uni } = spec
    ? await admin
        .from("universities")
        .select("name_ko")
        .eq("id", spec.university_id)
        .maybeSingle()
    : { data: null as { name_ko: string } | null };

  return {
    university: uni?.name_ko ?? null,
    department: app.target_department_label ?? null,
    term: app.term || spec?.term || null,
  };
}
