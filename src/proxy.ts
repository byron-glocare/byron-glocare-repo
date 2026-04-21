import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로에 적용:
     * - _next/static  (정적 파일)
     * - _next/image   (이미지 최적화)
     * - favicon.ico
     * - 확장자가 있는 정적 자산 (.png, .svg, .jpg 등)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
