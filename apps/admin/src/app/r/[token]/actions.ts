"use server";

import { createAdminClient } from "@/lib/supabase/server";
import {
  resumeDraftDataSchema,
  type ResumeDraftDataInput,
} from "@/lib/validators";

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 공개 폼 — 학생이 작성 내용을 저장 (token 으로 인증).
 * RLS 우회를 위해 service_role 클라이언트 사용. submitted_at 갱신.
 */
export async function submitResumeDraft(
  token: string,
  data: ResumeDraftDataInput
): Promise<SubmitResult> {
  if (!token || token.length < 16) {
    return { ok: false, error: "잘못된 링크입니다." };
  }
  const parsed = resumeDraftDataSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = createAdminClient();

  // 만료 / 미존재 검증
  const { data: draft, error: fetchErr } = await supabase
    .from("resume_drafts")
    .select("id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!draft) return { ok: false, error: "링크가 만료되었거나 존재하지 않습니다." };
  if (new Date(draft.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "링크 유효기간이 지났습니다. 관리자에게 재발급 요청하세요." };
  }

  const { error } = await supabase
    .from("resume_drafts")
    .update({
      data: parsed.data,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", draft.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
