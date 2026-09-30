import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { SHARE_LINK_HOST } from "@/lib/share-links";

/**
 * 매 요청마다 Supabase 세션을 갱신하고, 미인증 사용자를 /login 으로 보냅니다.
 * /login 과 /api/admin 등 공개 라우트는 통과시킵니다.
 */
export async function updateSession(request: NextRequest) {
  // 파일 다운로드 단축 링크 (/d/<code>) — 코드 자체가 인증. 세션 조회 불필요.
  // go.glocare.co.kr 은 이 링크 전용 도메인 → /d/* 외 경로는 전부 404 (어드민 노출 차단).
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const isShareLink = request.nextUrl.pathname.startsWith("/d/");
  if (host === SHARE_LINK_HOST) {
    return isShareLink
      ? NextResponse.next({ request })
      : new NextResponse("Not Found", { status: 404 });
  }
  if (isShareLink) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 세션 토큰 갱신 트리거
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isApiRoute = pathname.startsWith("/api");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/glocare_logo.png";
  // /r/[token] = 학생용 공개 이력서 작성 폼 (token 자체가 인증)
  const isPublicResumeRoute = pathname.startsWith("/r/");

  // 미로그인 + API 라우트 → 401 JSON (리다이렉트 대신)
  if (!user && isApiRoute) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 미로그인 + 보호 라우트 → /login
  if (!user && !isAuthRoute && !isPublicAsset && !isPublicResumeRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 로그인 상태에서 /login 접근 → / 로
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return response;
}
