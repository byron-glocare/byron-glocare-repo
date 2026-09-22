"use client";

/**
 * 끊겨도 이어서 올라가는 업로드 — 서명 업로드 토큰(createSignedUploadUrl)으로.
 *
 *   배경(2026-09-22): 베트남 유학센터에서 6.7MB PDF 가 "Failed to fetch" 로 계속 실패했다.
 *   같은 계정이 7월엔 6.8MB PDF 를 올렸고, 같은 날 2MB PDF 는 올라갔으며, 한국에서는 같은 파일이
 *   0.6초에 올라간다 → 베트남→한국 저장소 경로에서 큰 요청 하나가 중간에 끊기는 것.
 *   파일을 1MB 조각으로 나눠 TUS(재개 가능 업로드)로 보내고, 조각이 끊기면 서버에 받은 위치를
 *   물어(HEAD) 그 자리부터 다시 보낸다. Supabase 가 서명 토큰(x-signature)으로 TUS 를 받는 것을
 *   실제 저장소에 1MB 조각으로 올려 확인했다.
 *
 *   작은 파일(1.5MB 이하)은 한 번에 보내되 실패하면 두 번 더 시도한다.
 */

import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CHUNK = 1024 * 1024; // 1MB
const SMALL = 1.5 * 1024 * 1024;
const MAX_TRIES = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

export type UploadProgress = (sentBytes: number, totalBytes: number) => void;

export async function uploadWithSignedToken(input: {
  bucket: string;
  path: string;
  token: string;
  file: File;
  onProgress?: UploadProgress;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { bucket, path, token, file, onProgress } = input;
  const contentType = file.type || "application/octet-stream";
  const base = {
    apikey: ANON_KEY,
    "x-signature": token,
    "Tus-Resumable": "1.0.0",
  };

  // ── 작은 파일: 한 번에 (재시도 3회)
  if (file.size <= SMALL) {
    const sb = createClient();
    let lastErr = "";
    for (let i = 0; i < 3; i++) {
      try {
        const { error } = await sb.storage
          .from(bucket)
          .uploadToSignedUrl(path, token, file, { contentType, upsert: true });
        if (!error) {
          onProgress?.(file.size, file.size);
          return { ok: true };
        }
        lastErr = error.message;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
      await sleep(1000 * (i + 1));
    }
    return { ok: false, error: lastErr || "업로드 실패" };
  }

  // ── 큰 파일: TUS 1MB 조각
  let location: string | null = null;
  let lastErr = "";
  for (let i = 0; i < 3 && !location; i++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/upload/resumable/sign`, {
        method: "POST",
        headers: {
          ...base,
          "x-upsert": "true",
          "Upload-Length": String(file.size),
          "Upload-Metadata": [
            `bucketName ${b64(bucket)}`,
            `objectName ${b64(path)}`,
            `contentType ${b64(contentType)}`,
            `cacheControl ${b64("3600")}`,
          ].join(","),
        },
      });
      if (res.status === 201) location = res.headers.get("location");
      else lastErr = `${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (!location) await sleep(1000 * (i + 1));
  }
  if (!location) return { ok: false, error: lastErr || "업로드 시작 실패" };

  let offset = 0;
  let tries = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK, file.size));
    try {
      const res = await fetch(location, {
        method: "PATCH",
        headers: { ...base, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
        body: chunk,
      });
      if (res.status === 204) {
        offset = Number(res.headers.get("upload-offset") ?? offset + chunk.size);
        tries = 0;
        onProgress?.(offset, file.size);
        continue;
      }
      lastErr = `${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`;
      if (res.status !== 409 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        return { ok: false, error: lastErr };
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    // 끊김 — 서버가 받은 위치를 다시 물어 그 자리부터
    tries += 1;
    if (tries >= MAX_TRIES) return { ok: false, error: `${lastErr} (조각 재시도 ${MAX_TRIES}회 실패)` };
    await sleep(Math.min(8000, 1000 * 2 ** (tries - 1)));
    try {
      const head = await fetch(location, { method: "HEAD", headers: base });
      const o = Number(head.headers.get("upload-offset"));
      if (head.ok && Number.isFinite(o)) offset = o;
    } catch {
      // 다음 시도에서 다시
    }
  }
  return { ok: true };
}
