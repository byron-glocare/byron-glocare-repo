/**
 * /auth/callback — OAuth(구글) / 매직링크 콜백.
 *   1. code → 세션 교환 (쿠키 기록)
 *   2. 학생 행(study_managed_students, source='self') 없으면 생성 (service role)
 *   3. next 로 이동 (기본 /student)
 *
 * 구글·이메일 공용. 유학센터(/center) 로그인과는 별개 축.
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/student";
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/student/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/student/login?error=${encodeURIComponent(error.message)}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // 학생 행 보장 (service role — RLS 우회, auth_user_id 로 1:1)
    const svc = createServiceClient();
    const { data: existing } = await svc
      .from("study_managed_students")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!existing) {
      const meta = (user.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
      };
      await svc.from("study_managed_students").insert({
        auth_user_id: user.id,
        source: "self",
        org_id: null,
        name: meta.full_name || meta.name || user.email || "학생",
        email: user.email ?? null,
      });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
