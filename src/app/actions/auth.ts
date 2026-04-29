"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type SnsProvider = "google" | "facebook";

/**
 * SNS OAuth 로그인 시작 — provider 별 인증 URL 로 redirect.
 *
 * @param provider 'google' / 'facebook'
 * @param next 로그인 후 돌아갈 path (옵션, 기본 '/')
 */
export async function signInWithSns(provider: SnsProvider, next: string = "/") {
  const supabase = await createClient();

  // Vercel 배포 시 NEXT_PUBLIC_SITE_URL 또는 자동으로 host 사용
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";
  const baseUrl = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (!data?.url) {
    return { ok: false as const, error: "No OAuth URL returned" };
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}
