import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateResumeDocx } from "@/lib/docx/generate-resume";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const supabase = await createClient();

  // 가장 최근 submitted draft 로
  const { data: draft, error } = await supabase
    .from("resume_drafts")
    .select("data, customer_id, photo_path")
    .eq("customer_id", customerId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!draft) {
    return NextResponse.json(
      { error: "제출된 이력서가 없습니다." },
      { status: 404 }
    );
  }

  // 파일명 — 학생 이름 기반
  const { data: customer } = await supabase
    .from("customers")
    .select("code, name_kr, name_vi")
    .eq("id", customerId)
    .single();
  const baseName =
    (customer?.name_vi || customer?.name_kr || customer?.code || "resume")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim();
  const filename = `이력서_${baseName}.docx`;
  const asciiFallback = `resume_${customer?.code ?? "unknown"}.docx`;

  // 사진 다운로드 (있는 경우만)
  let photoBuffer: Buffer | null = null;
  if (draft.photo_path) {
    const { data: photoBlob } = await supabase.storage
      .from("resume-photos")
      .download(draft.photo_path);
    if (photoBlob) {
      photoBuffer = Buffer.from(await photoBlob.arrayBuffer());
    }
  }

  let buf: Buffer;
  try {
    buf = await generateResumeDocx(draft.data, photoBuffer);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "docx 생성 실패" },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
