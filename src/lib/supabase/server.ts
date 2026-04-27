/**
 * Supabase server-side client (anon key).
 * 홈페이지는 익명 사용자만 접근 — admin auth 없음.
 * RLS 가 익명 read (active=true) / insert (폼) 허용.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

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
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component 에서 호출 시 set 불가 — 무시
          }
        },
      },
    }
  );
}
