/**
 * POST /api/admission/student-documents — 어드민(내부)용 학생 서류 현황.
 *   인증: 헤더 `X-Internal-Token` = `process.env.INTERNAL_API_TOKEN` (extract·analyze-form 과 같음)
 *   본문: { studentIds: string[] }  (최대 200명)
 *
 *   센터 화면과 **같은 계산**을 그대로 돌려준다 — 어드민이 서류 규칙을 따로 복사하면 두 화면 숫자가 어긋난다.
 *     발급서류 = loadDocumentGroups (서류 등록 화면과 같음: 공유 키·옛 키·구제 매칭)
 *     작성서류 = 지원 학과의 현행 양식 파일 + 최종 서류 제출 상태 (최종 서류 화면과 같음)
 *   지원별로 묶는다(1~3지망). 취소된 지원은 뺀다.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { loadDocumentGroups } from "@/lib/admission/student-documents";
import { loadApplicationDocuments } from "@/lib/admission/spec-documents";

export const runtime = "nodejs";
export const maxDuration = 60;

export type StudentDocStatus = {
  studentId: string;
  applications: Array<{
    appId: string;
    label: string;
    term: string;
    issued: Array<{ name: string; required: boolean; uploaded: boolean; fileName: string | null }>;
    /** status: none = 아직 / uploaded = 완성본 올림(미제출) / submitted = 최종 제출 */
    forms: Array<{ name: string; status: "none" | "uploaded" | "submitted" }>;
  }>;
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) return NextResponse.json({ ok: false, error: "INTERNAL_API_TOKEN not configured" }, { status: 500 });
  if (!token || token !== expected) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let ids: string[];
  try {
    const body = (await req.json()) as { studentIds?: unknown };
    ids = Array.isArray(body.studentIds) ? body.studentIds.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다" }, { status: 400 });
  }
  ids = Array.from(new Set(ids)).slice(0, 200);

  const svc = createServiceClient();
  const out: StudentDocStatus[] = [];
  // DB 가 작아(Nano) 동시에 4명씩만
  for (let i = 0; i < ids.length; i += 4) {
    const part = await Promise.all(ids.slice(i, i + 4).map((id) => loadOne(svc, id)));
    out.push(...part);
  }
  return NextResponse.json({ ok: true, students: out });
}

async function loadOne(svc: ReturnType<typeof createServiceClient>, studentId: string): Promise<StudentDocStatus> {
  const { data: apps } = await svc
    .from("study_applications")
    .select("id, admission_spec_id, target_department_id, target_department_label, term, status, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });
  const active = (apps ?? []).filter((a) => a.status !== "cancelled");
  if (active.length === 0) return { studentId, applications: [] };

  const [{ groups }, { byApp }, { data: finals }] = await Promise.all([
    loadDocumentGroups(svc, studentId, "ko"),
    loadApplicationDocuments(svc, active),
    svc
      .from("study_student_final_docs")
      .select("form_file_id, application_id, submitted_at")
      .eq("student_id", studentId),
  ]);
  const finalBy = new Map((finals ?? []).map((f) => [`${f.form_file_id}::${f.application_id}`, f.submitted_at as string | null]));
  const groupBy = new Map(groups.map((g) => [g.appId, g]));

  return {
    studentId,
    applications: active.map((a) => {
      const g = groupBy.get(a.id);
      const formFiles = byApp.get(a.id)?.formFiles ?? null;
      const forms: StudentDocStatus["applications"][number]["forms"] = formFiles
        ? formFiles.map((f) => {
            const key = `${f.id}::${a.id}`;
            return {
              name: f.name_ko,
              status: finalBy.has(key) ? (finalBy.get(key) ? "submitted" : "uploaded") : "none",
            };
          })
        : // 학과를 못 찾는 옛 지원 — 이름만(상태는 알 수 없어 '아직')
          (g?.formDocs ?? []).map((d) => ({ name: d.name_ko, status: "none" as const }));
      return {
        appId: a.id,
        label: g?.label ?? a.target_department_label ?? "",
        term: g?.term ?? a.term ?? "",
        issued: (g?.issued ?? []).map((it) => ({
          name: it.name_ko,
          required: it.required,
          uploaded: it.file != null,
          fileName: it.file?.file_name ?? null,
        })),
        forms,
      };
    }),
  };
}
