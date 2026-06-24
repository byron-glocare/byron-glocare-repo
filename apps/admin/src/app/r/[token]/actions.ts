"use server";

import { createAdminClient } from "@/lib/supabase/server";
import {
  resumeDraftDataSchema,
  type ResumeDraftDataInput,
} from "@/lib/validators";
import { polishResumeNarrative } from "@/lib/resume/polish";

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

  // AI 다듬기 — 학생 raw 텍스트 → 한국어 어색한 외국인 톤. 실패해도 raw 그대로 저장.
  let polished = parsed.data.narrative_polished;
  if (parsed.data.narrative_raw.trim().length >= 20) {
    const r = await polishResumeNarrative({
      rawText: parsed.data.narrative_raw,
      studentName: parsed.data.name_kr || parsed.data.name_vi,
    });
    if (r.ok) polished = r.polished;
    // 실패 시 polished 는 기존 값 또는 빈 문자열 — docx 생성 시 raw 로 fallback
  }

  const { error } = await supabase
    .from("resume_drafts")
    .update({
      data: { ...parsed.data, narrative_polished: polished },
      submitted_at: new Date().toISOString(),
    })
    .eq("id", draft.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

const PHOTO_BUCKET = "resume-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * 학생 사진 업로드 — base64 dataURL 형태로 받음. 5MB 제한, jpeg/png/webp 만.
 * 같은 customer_id 의 옛 사진은 덮어쓰기 (1인 1사진).
 */
export async function uploadResumePhoto(
  token: string,
  dataUrl: string
): Promise<SubmitResult> {
  if (!token || token.length < 16) {
    return { ok: false, error: "잘못된 링크입니다." };
  }
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) {
    return { ok: false, error: "지원되지 않는 이미지 형식입니다. JPEG/PNG/WebP 만 허용." };
  }
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_PHOTO_BYTES) {
    return { ok: false, error: "사진 크기가 5MB를 초과합니다." };
  }

  const supabase = createAdminClient();

  const { data: draft, error: fetchErr } = await supabase
    .from("resume_drafts")
    .select("id, customer_id, expires_at, photo_path")
    .eq("token", token)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!draft) return { ok: false, error: "링크가 만료되었거나 존재하지 않습니다." };
  if (new Date(draft.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "링크 유효기간이 지났습니다." };
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${draft.customer_id}/${draft.id}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, buf, { contentType: mime, upsert: true });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  // 기존 path 와 다른 ext 면 옛 파일 정리
  if (draft.photo_path && draft.photo_path !== path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([draft.photo_path]);
  }

  const { error: dbErr } = await supabase
    .from("resume_drafts")
    .update({ photo_path: path })
    .eq("id", draft.id);
  if (dbErr) return { ok: false, error: dbErr.message };

  return { ok: true };
}
