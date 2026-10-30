/**
 * abroad 의 /api/admission/student-documents 호출 — 학생별·지원별 서류 현황.
 *   서류 규칙(필요 서류·업로드 매칭·작성서류 제출)은 abroad 센터 화면에 있다. 어드민이 복사해 두면
 *   두 화면 숫자가 어긋나므로 같은 계산을 내부 API 로 받아 쓴다(analyze-form·extract 와 같은 방식).
 *   실패하면 null — 화면은 서류 현황 없이(업로드 개수만으로) 그대로 보여야 한다.
 */

import "server-only";

// apex 는 www 로 307 리다이렉트됨 → 인증 헤더/본문 유실 방지 위해 www 로 직접 호출.
const DEFAULT_URL = "https://www.youstudyinkorea.com/api/admission/student-documents";

function endpointUrl(): string {
  const ext = process.env.EXTRACTION_API_URL?.trim();
  if (ext) return ext.replace(/\/api\/admission\/extract\/?$/, "/api/admission/student-documents");
  return DEFAULT_URL;
}

export type DocFormStatus = "none" | "uploaded" | "submitted";

export type StudentDocStatus = {
  studentId: string;
  applications: Array<{
    appId: string;
    label: string;
    term: string;
    issued: Array<{ name: string; required: boolean; uploaded: boolean; fileName: string | null }>;
    forms: Array<{ name: string; status: DocFormStatus }>;
  }>;
};

export async function fetchStudentDocStatus(studentIds: string[]): Promise<Map<string, StudentDocStatus> | null> {
  const token = process.env.INTERNAL_API_TOKEN?.trim();
  if (!token || studentIds.length === 0) return studentIds.length === 0 ? new Map() : null;
  try {
    const res = await fetch(endpointUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify({ studentIds }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; students?: StudentDocStatus[] };
    if (!json.ok || !Array.isArray(json.students)) return null;
    return new Map(json.students.map((s) => [s.studentId, s]));
  } catch {
    return null;
  }
}

/** 지원 하나의 완료 개수 — 필수 발급서류 업로드 + 작성서류 최종 제출 (선택 서류는 세지 않는다) */
export function docProgress(app: StudentDocStatus["applications"][number]): { done: number; total: number } {
  const req = app.issued.filter((d) => d.required);
  const total = req.length + app.forms.length;
  const done = req.filter((d) => d.uploaded).length + app.forms.filter((f) => f.status === "submitted").length;
  return { done, total };
}
