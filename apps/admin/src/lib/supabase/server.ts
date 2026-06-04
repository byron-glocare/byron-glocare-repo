import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * 서버 컴포넌트 / Route Handler / Server Action 에서 사용하는
 * Supabase 클라이언트. 요청별 쿠키를 읽어 세션을 복원합니다.
 *
 * Server Component 안에서 set/remove 호출은 무시됩니다 (Next.js 제약).
 * 세션 갱신은 middleware.ts 에서 처리합니다.
 */
export async function createClient() {
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 컨텍스트에서는 set 불가 — 무시.
            // middleware.ts 가 응답 쿠키를 갱신함.
          }
        },
      },
    }
  );
}

/**
 * Service Role 키를 사용하는 어드민 클라이언트.
 * RLS 우회 가능. **반드시 서버 사이드(API Route, Server Action)에서만 사용.**
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );
}
