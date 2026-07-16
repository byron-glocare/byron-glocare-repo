import { scanDocxSlots } from "@/lib/docx/inline-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /test/form-fill/scan — docx 업로드 → 빈칸 탐지.
 *   응답: { slots, markedDocx(base64) }  — markedDocx 는 브라우저 미리보기용
 *   (⟦S{n}⟧ 마커가 박혀 있어 클라이언트가 클릭 가능한 칩으로 바꾼다)
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
    return Response.json({ error: "DOCX 파일을 첨부하세요." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return Response.json(
      { error: ".docx 파일만 지원합니다. (.hwp 는 Word 로 변환 후 사용)" },
      { status: 400 }
    );
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { markedBuf, slots } = scanDocxSlots(buf);
    return Response.json({
      slots,
      markedDocx: markedBuf.toString("base64"),
    });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message ?? "빈칸 탐지에 실패했습니다." },
      { status: 500 }
    );
  }
}
