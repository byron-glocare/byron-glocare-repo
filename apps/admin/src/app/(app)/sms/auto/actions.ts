"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ANCHOR_VALUES } from "@/lib/auto-sms";

export type AutoSmsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type RuleInput = {
  id?: string;
  name: string;
  title: string;
  anchor_field: string;
  offset_days: number;
  /** null = 즉시 */
  send_time: string | null;
  body: string;
  image_path: string | null;
  is_active: boolean;
};

function validate(input: RuleInput): string | null {
  if (!input.name.trim()) return "문자 이름을 입력해주세요.";
  if (input.title.length > 40) return "제목은 40자 이하로 입력해주세요.";
  if (!ANCHOR_VALUES.includes(input.anchor_field))
    return "기준 날짜가 올바르지 않습니다.";
  if (
    !Number.isInteger(input.offset_days) ||
    input.offset_days < -365 ||
    input.offset_days > 365
  )
    return "일수는 -365 ~ 365 사이의 정수여야 합니다.";
  if (input.send_time !== null && !/^\d{2}:\d{2}$/.test(input.send_time))
    return "발송 시간 형식이 올바르지 않습니다.";
  if (!input.body.trim()) return "내용을 입력해주세요.";
  // {이름} 치환으로 본문이 늘어날 수 있어 발송 한도(2000 byte)보다 여유를 둔다
  if (new TextEncoder().encode(input.body).length > 1900)
    return "본문이 너무 깁니다 (1900 byte 이하).";
  return null;
}

export async function saveAutoSmsRule(
  input: RuleInput
): Promise<AutoSmsActionResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const row = {
    name: input.name.trim(),
    title: input.title.trim() || null,
    anchor_field: input.anchor_field,
    offset_days: input.offset_days,
    send_time: input.send_time,
    body: input.body,
    image_path: input.image_path,
    is_active: input.is_active,
  };

  const { error } = input.id
    ? await supabase.from("auto_sms_rules").update(row).eq("id", input.id)
    : await supabase
        .from("auto_sms_rules")
        .insert({ ...row, created_by: user.id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sms/auto");
  return { ok: true };
}

export async function toggleAutoSmsRule(
  id: string,
  isActive: boolean
): Promise<AutoSmsActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("auto_sms_rules")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sms/auto");
  return { ok: true };
}

export async function deleteAutoSmsRule(
  id: string
): Promise<AutoSmsActionResult> {
  const supabase = await createClient();

  const { data: rule } = await supabase
    .from("auto_sms_rules")
    .select("image_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("auto_sms_rules").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (rule?.image_path) {
    // 이미지 정리 실패는 치명적이지 않으므로 무시
    await supabase.storage.from("sms-images").remove([rule.image_path]);
  }

  revalidatePath("/sms/auto");
  return { ok: true };
}

/**
 * 첨부 이미지 업로드 — jpg/jpeg, 최대 300KB (해상도 1000x1000 이하는
 * 브라우저에서 선검증). 성공 시 스토리지 경로와 공개 URL 반환.
 */
export async function uploadAutoSmsImage(
  formData: FormData
): Promise<
  { ok: true; path: string; url: string } | { ok: false; error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "파일이 없습니다." };

  const isJpg =
    /\.jpe?g$/i.test(file.name) ||
    file.type === "image/jpeg" ||
    file.type === "image/jpg";
  if (!isJpg) return { ok: false, error: "jpg/jpeg 이미지만 첨부할 수 있습니다." };
  if (file.size > 300 * 1024)
    return { ok: false, error: "이미지는 최대 300KB 까지 가능합니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("sms-images")
    .upload(path, file, { contentType: "image/jpeg" });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from("sms-images").getPublicUrl(path);
  return { ok: true, path, url: data.publicUrl };
}
