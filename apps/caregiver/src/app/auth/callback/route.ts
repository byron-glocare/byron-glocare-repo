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

  // 세션 설정 완료 → 매핑 확인 후 적절한 페이지로
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!customer) {
      // unmapped → 본인 확인 페이지
      url.pathname = "/verify";
      url.searchParams.delete("code");
      url.searchParams.delete("next");
      url.searchParams.set("from", next);
      return NextResponse.redirect(url);
    }
  }

  // mapped → 원래 가려던 곳으로
  url.pathname = next;
  url.search = "";
  return NextResponse.redirect(url);
}
