/**
 * 한글 TTF 폰트 로더 (PDF 채움용).
 *
 *   폰트는 public/fonts 에 두고 런타임에 같은 오리진에서 fetch 한다.
 *   (Vercel 서버리스 함수 FS 에는 public/ 이 포함되지 않으므로 fs 읽기 대신 HTTP fetch.)
 *   한 번 받으면 모듈 스코프에 캐시.
 */

import "server-only";

const FONT_PATH = "/fonts/NanumGothic-Regular.ttf";

let cached: Uint8Array | null = null;

export async function loadKoreanFont(origin: string): Promise<Uint8Array> {
  if (cached) return cached;
  const res = await fetch(`${origin}${FONT_PATH}`, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`한글 폰트 로드 실패 (${res.status})`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  cached = buf;
  return buf;
}
