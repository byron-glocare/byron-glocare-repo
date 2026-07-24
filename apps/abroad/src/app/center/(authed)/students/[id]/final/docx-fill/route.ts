/**
 * GET /center/students/[id]/final/docx-fill?form=<formFileId>[&preview=1]
 *   업로드된 .docx 원본 양식을 학생의 실제 표준데이터로 채워 반환.
 *   채움 로직은 lib/admission/fill-form-doc(공용). 여기선 센터 세션 검증만.
 */

import { type NextRequest } from "next/server";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { fillFormDocx, docxResponse } from "@/lib/admission/fill-form-doc";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await verifyCenterSession();
  const { id } = await params;
  const formFileId = req.nextUrl.searchParams.get("form") ?? "";
  const isPreview = req.nextUrl.searchParams.get("preview") === "1";
  const supabase = await createCenterClient();

  const result = await fillFormDocx(supabase, id, formFileId);
  if (!result.ok) {
    return new Response(result.message, { status: result.status });
  }
  return docxResponse(result, isPreview);
}
