import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { SHARE_CODE_RE, SHARE_FILES_BUCKET } from "@/lib/share-links";

export const dynamic = "force-dynamic";

/**
 * GET /d/<code> — 문자로 보낸 파일 다운로드 링크 (공개, 코드 자체가 인증).
 *
 *  1. 코드 조회 (service_role — 테이블은 RLS 정책 없음)
 *  2. 없음 / 취소 / 만료 → 안내 페이지
 *  3. 유효 → 열람 기록 후 60초짜리 서명 URL(다운로드 헤더 포함)로 302
 *     → 스마트폰에서 파일이 바로 저장된다. 버킷은 비공개라 서명 URL 없이 접근 불가.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!SHARE_CODE_RE.test(code)) return notice(404, "링크를 찾을 수 없어요", "주소가 정확한지 확인해 주세요.");

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("file_share_links")
    .select("id, storage_path, file_name, expires_at, revoked_at, download_count")
    .eq("code", code)
    .maybeSingle();

  if (!link) {
    return notice(404, "링크를 찾을 수 없어요", "주소가 정확한지 확인해 주세요.");
  }
  if (link.revoked_at) {
    return notice(410, "사용이 중지된 링크예요", "글로케어에 새 링크를 요청해 주세요.");
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return notice(410, "다운로드 기간이 지났어요", "링크는 발송 후 30일 동안만 열 수 있어요. 글로케어에 다시 요청해 주세요.");
  }

  const { data: signed, error } = await admin.storage
    .from(SHARE_FILES_BUCKET)
    .createSignedUrl(link.storage_path, 60, { download: link.file_name });
  if (error || !signed) {
    return notice(500, "파일을 불러오지 못했어요", "잠시 후 다시 시도해 주세요.");
  }

  await admin
    .from("file_share_links")
    .update({
      download_count: link.download_count + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function notice(status: number, title: string, desc: string) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>글로케어</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#f6f7f9;color:#1f2937;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.c{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 24px;max-width:360px;width:100%;text-align:center}
h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#6b7280;margin:0;line-height:1.6}.b{font-weight:700;color:#111827;margin-bottom:16px;font-size:15px}</style>
</head><body><div class="c"><div class="b">글로케어</div><h1>${title}</h1><p>${desc}</p></div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
