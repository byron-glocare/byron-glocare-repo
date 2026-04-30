"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * 영상 시청 완료 토글.
 * 이미 시청 row 있으면 삭제 (취소), 없으면 insert.
 */
export async function toggleWatched(
  videoId: number
): Promise<{ ok: true; watched: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { data: existing } = await supabase
    .from("video_views")
    .select("id")
    .eq("user_id", user.id)
    .eq("video_id", videoId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("video_views")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/videos");
    revalidatePath(`/videos/${videoId}`);
    return { ok: true, watched: false };
  }

  const { error } = await supabase.from("video_views").insert({
    user_id: user.id,
    video_id: videoId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/videos");
  revalidatePath(`/videos/${videoId}`);
  return { ok: true, watched: true };
}
