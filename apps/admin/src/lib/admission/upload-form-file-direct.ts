"use client";

/**
 * 작성서류 양식 파일을 브라우저에서 Supabase Storage 로 바로 올린다.
 *
 *   예전에는 파일 전체를 base64 로 서버 액션에 실어 보냈다. Vercel 서버 함수는 요청 본문이
 *   약 4.5MB 를 넘으면 받지도 못하고 끊기 때문에, 3.3MB 넘는 파일은 화면이
 *   "This page couldn't load" 로 죽었다(2026-09-22 운영자 제보).
 *   이제 서버는 서명 업로드 주소만 만들고(createFormUploadUrlAction), 파일은 저장소로 직접 간다.
 *   돌려받은 path 를 uploadFormFileAction 의 storage_path 로 넘기면 된다.
 */

import { createClient } from "@/lib/supabase/client";
import { createFormUploadUrlAction } from "@/app/(app)/universities/[id]/forms/actions";

const BUCKET = "admission-form-files";

export async function uploadFormFileDirect(
  universityId: number,
  file: File
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  try {
    const signed = await createFormUploadUrlAction(universityId, file.name);
    if (!signed.ok) return signed;
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) return { ok: false, error: `파일 올리기 실패: ${error.message}` };
    return { ok: true, path: signed.path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
