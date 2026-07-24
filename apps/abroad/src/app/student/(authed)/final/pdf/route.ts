/**
 * GET /student/final/pdf?form=<formFileId>&app=<applicationId>[&preview=1][&inputs=<json>]
 *   셀프 학생 본인의 데이터로 PDF 양식(좌표 오버레이)을 채워 반환.
 *   채움 로직은 lib/admission/fill-form-doc(센터와 공용). 세션만 학생.
 */

import { type NextRequest } from "next/server";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { fillFormPdf, pdfResponse } from "@/lib/admission/fill-form-doc";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await verifyStudentSession();
  const formFileId = req.nextUrl.searchParams.get("form") ?? "";
  const appId = req.nextUrl.searchParams.get("app") ?? "";
  const isPreview = req.nextUrl.searchParams.get("preview") === "1";

  let inputVals: Record<string, string> = {};
  try {
    const raw = req.nextUrl.searchParams.get("inputs");
    if (raw) inputVals = JSON.parse(raw) as Record<string, string>;
  } catch {
    inputVals = {};
  }

  const supabase = await createClient();
  const result = await fillFormPdf(supabase, {
    studentId: session.student.id,
    formFileId,
    appId,
    inputVals,
    origin: req.nextUrl.origin,
  });
  if (!result.ok) {
    return new Response(result.message, { status: result.status });
  }
  return pdfResponse(result, isPreview);
}
