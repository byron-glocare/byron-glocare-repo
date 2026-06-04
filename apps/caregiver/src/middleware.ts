import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * 로그인 필요한 페이지 prefix 들. 비로그인 시 /login 으로 리다이렉트.
 */
const PROTECTED_PREFIXES = [
  "/cbt",
  "/videos",
  "/resume",
  "/profile",
  "/verify",
];

/**
 * 미들웨어 — 매 요청마다 Supabase 세션 갱신 + 보호 페이지 가드.
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // 이미 로그인했는데 /login 들어오면 홈으로
  if (path === "/login" && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon.svg, etc.
     * - api/* (handled separately if needed)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
