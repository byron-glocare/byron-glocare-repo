import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * auth 사용자에 대응하는 학생 행(study_managed_students, source='self')을 보장한다.
 *
 * 구글 OAuth 는 /auth/callback 에서, 이메일·비밀번호 로그인은 서버 액션에서
 * 각각 호출한다. RLS 를 우회해야 하므로 service role 로 처리한다.
 * 동시 요청으로 유니크 경합이 나면 이미 만들어진 것이므로 성공으로 본다.
 */
export async function ensureStudentRow(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const svc = createServiceClient();

  const { data: existing, error: selErr } = await svc
    .from("study_managed_students")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (selErr) return { ok: false, error: `lookup:${selErr.message}` };
  if (existing) return { ok: true };

  const meta = (user.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
  };
  const { error: insErr } = await svc.from("study_managed_students").insert({
    auth_user_id: user.id,
    source: "self",
    org_id: null,
    name: meta.full_name || meta.name || user.email || "학생",
    email: user.email ?? null,
  });
  if (insErr && !/duplicate key|unique/i.test(insErr.message)) {
    return { ok: false, error: `create:${insErr.message}` };
  }
  return { ok: true };
}
