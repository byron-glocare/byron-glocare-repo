/**
 * 외부 어드민(/center/*) — Client Components 용 브라우저 Supabase 클라이언트.
 *   sign in / sign out / 비밀번호 reset / 토큰 refresh 등 브라우저 측 인증 흐름.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

export function createCenterBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
