import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { tokenizeAndFillDocx } from "@/lib/docx/fill";

export const runtime = "nodejs";

/** POST: .docx 업로드 → 자동 토큰화 + 더미값 채움 → 채워진 .docx 반환 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user))
    return new NextResponse("Forbidden", { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return new NextResponse("파일을 선택하세요.", { status: 400 });
  if (!file.name.toLowerCase().endsWith(".docx"))
    return new NextResponse(".docx 파일만 가능합니다. (.doc/.hwp 는 변환 후)", {
      status: 400,
    });

  const buf = Buffer.from(await file.arrayBuffer());
  let result: ReturnType<typeof tokenizeAndFillDocx>;
  try {
    result = tokenizeAndFillDocx(buf);
  } catch (e) {
    return new NextResponse(
      e instanceof Error ? e.message : "처리 실패",
      { status: 500 }
    );
  }

  const fname = encodeURIComponent(
    file.name.replace(/\.docx$/i, "") + "_채움예시.docx"
  );
  const detected = encodeURIComponent(
    JSON.stringify(result.detected.map((d) => d.label))
  );

  return new NextResponse(result.filled as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${fname}`,
      "X-Detected": detected,
      "Cache-Control": "no-store",
    },
  });
}
