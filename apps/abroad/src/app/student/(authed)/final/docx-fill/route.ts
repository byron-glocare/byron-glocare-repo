/**
 * GET /student/final/docx-fill?form=<formFileId>[&preview=1]
 *   셀프 학생 본인의 표준데이터로 .docx 원본 양식을 채워 반환.
 *   채움 로직은 lib/admission/fill-form-doc(센터와 공용). 세션만 학생.
 */

import { type NextRequest } from "next/server";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { fillFormDocx, docxResponse } from "@/lib/admission/fill-form-doc";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await verifyStudentSession();
  const formFileId = req.nextUrl.searchParams.get("form") ?? "";
  const isPreview = req.nextUrl.searchParams.get("preview") === "1";
  const supabase = await createClient();

  const result = await fillFormDocx(supabase, session.student.id, formFileId);
  if (!result.ok) {
    return new Response(result.message, { status: result.status });
  }
  return docxResponse(result, isPreview);
}
