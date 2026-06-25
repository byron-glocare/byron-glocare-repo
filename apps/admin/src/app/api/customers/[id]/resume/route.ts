import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { generateResumeDocx } from "@/lib/docx/generate-resume";

// 매 요청마다 최신 draft 데이터로 docx 생성 — 캐싱 금지
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;

  // admin 인증 검사 (storage RLS 우회 전에 권한 확인)
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // resume_drafts 조회 + storage download 는 service_role 로 — RLS 우회.
  // 사진 bucket 이 private 라 anon/authenticated 모두 storage RLS 막힘.
  const supabase = createAdminClient();

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

  // 사진 다운로드 (있는 경우만) — service_role 로 RLS 우회
  let photoBuffer: Buffer | null = null;
  if (draft.photo_path) {
    const { data: photoBlob, error: photoErr } = await supabase.storage
      .from("resume-photos")
      .download(draft.photo_path);
    if (photoErr) {
      console.error("[resume] photo download failed:", photoErr, draft.photo_path);
    } else if (photoBlob) {
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
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
