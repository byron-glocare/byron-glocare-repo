import { fillTestDocx, type FillError } from "@/lib/docx/test-fill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * POST /test/form-fill/fill — 템플릿화된 DOCX 업로드 → 테스트 데이터로 채워 반환.
 *   성공: filled .docx (attachment)
 *   실패: JSON { error, details? } (운영자가 원본 토큰을 고치도록 안내)
 */
export async function POST(req: Request): Promise<Response> {
  let file: unknown;
  try {
    const form = await req.formData();
    file = form.get("file");
  } catch {
    return Response.json({ error: "요청을 읽지 못했습니다." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { error: "DOCX 파일을 첨부하세요." },
      { status: 400 }
    );
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith(".docx")) {
    return Response.json(
      { error: ".docx 파일만 지원합니다. (한글 .hwp/.hwpx 는 Word 로 변환 후 사용)" },
      { status: 400 }
    );
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const out = await fillTestDocx(buf);
    return new Response(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="filled-${encodeURIComponent(
          file.name
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const err = e as Error & FillError;
    return Response.json(
      { error: err.message, details: err.details ?? [] },
      { status: 500 }
    );
  }
}
