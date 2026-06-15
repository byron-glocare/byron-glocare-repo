import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth 콜백 — Supabase 가 SNS 인증 후 ?code= 파라미터로 돌려보냄.
 * exchangeCodeForSession 으로 세션 쿠키 설정 후 next URL 로 redirect.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    url.pathname = "/login";
    url.searchParams.delete("next");
    url.searchParams.set("error", "no_code");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    url.pathname = "/login";
    url.searchParams.delete("code");
    url.searchParams.delete("next");
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  // 세션 설정 완료 → 본인 customer 자동 생성/연결 (자가가입)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const meta = (user.user_metadata ?? {}) as Record<string, string>;
    await supabase.rpc("create_self_customer", {
      p_name_kr: meta.full_name ?? meta.name ?? null,
      p_name_vi: null,
      p_phone: (user.phone as string) || meta.phone || null,
    });
  }

  // 원래 가려던 곳으로
  url.pathname = next;
  url.search = "";
  return NextResponse.redirect(url);
}
