/**
 * Next.js 16 — Proxy (구 middleware.ts 의 새 이름)
 *
 * 책임: 외부 어드민(/center/*) 라우트의 optimistic 인증 게이트.
 *   - Supabase Auth 세션 쿠키 존재 여부만 체크 (서명 검증 X — DAL 에서 수행)
 *   - 미인증 + /center/login·set-password 외 → /center/login 으로 redirect
 *   - 실제 인증·org membership 검증은 src/lib/center/dal.ts 의 verifyCenterSession()
 *
 * Next.js 16 변경: middleware.ts → proxy.ts. 파일 위치는 src/ 또는 root.
 *   (참고: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md)
 */

import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/center/login";
const SET_PASSWORD_PATH = "/center/set-password";

/** Supabase Auth 쿠키 명: 'sb-<project-ref>-auth-token' (또는 chunked 변형) */
function hasSupabaseSession(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some(
      (c) =>
        c.name.startsWith("sb-") &&
        (c.name.endsWith("-auth-token") || c.name.endsWith("-auth-token.0"))
    );
}

const STUDENT_LOGIN_PATH = "/student/login";

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // ── 학생(B2C) 영역: /student/* (로그인 페이지 제외) ──
  if (path === "/student" || path.startsWith("/student/")) {
    if (path === STUDENT_LOGIN_PATH) return NextResponse.next();
    if (!hasSupabaseSession(req)) {
      const url = req.nextUrl.clone();
      url.pathname = STUDENT_LOGIN_PATH;
      if (path !== "/student") {
        url.searchParams.set("next", path + req.nextUrl.search);
      }
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── 유학센터 영역: /center/* ──
  // 비인증 통과 허용 경로
  if (path === LOGIN_PATH || path.startsWith(SET_PASSWORD_PATH)) {
    return NextResponse.next();
  }

  // 그 외 /center/* 는 세션 쿠키 존재 필요
  if (!hasSupabaseSession(req)) {
    const url = req.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    if (path !== "/center") {
      url.searchParams.set("from", path + req.nextUrl.search);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/center/:path*", "/student/:path*"],
};
