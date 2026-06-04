/**
 * 외부 어드민(/center/*) — Server Components / Server Actions / Route Handlers 용
 *   인증된 사용자 세션을 쿠키에서 읽어 Supabase 클라이언트 생성.
 *   RLS 가 사용자 세션 기준으로 자동 적용됨.
 *
 * 공개 홈페이지 익명 클라이언트는 src/lib/supabase/server.ts 그대로 유지.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

export async function createCenterClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component 에서 호출 시 set 불가 — 무시
            // (Server Action / Route Handler 에선 set 가능)
          }
        },
      },
    }
  );
}
