/**
 * PDF 채움용 폰트 로더 (한국어 + 베트남어/라틴 2종).
 *
 *   학생 데이터는 베트남어(성조 문자 ố Đ ễ ư …)와 한국어가 섞여 있다.
 *   - 한국어 글자가 포함된 문자열 → NanumGothic (한글 글리프 보유)
 *   - 그 외(베트남어·영문) → Be Vietnam Pro (베트남어 성조 글리프 보유)
 *   NanumGothic 은 베트남어 성조 글리프가 없어 단독으로는 깨진다(빈 글리프).
 *
 *   폰트는 public/fonts 에 두고 런타임에 같은 오리진에서 fetch 한다.
 *   (Vercel 서버리스 함수 FS 에는 public/ 이 포함되지 않으므로 fs 읽기 대신 HTTP fetch.)
 *   한 번 받으면 모듈 스코프에 캐시. 둘 다 TTF(glyf) — pdf-lib 서브셋 임베드 가능.
 */

import "server-only";

const KO_PATH = "/fonts/NanumGothic-Regular.ttf";
const LATIN_PATH = "/fonts/BeVietnamPro-Regular.ttf";

let cachedKo: Uint8Array | null = null;
let cachedLatin: Uint8Array | null = null;

async function fetchFont(origin: string, path: string): Promise<Uint8Array> {
  const res = await fetch(`${origin}${path}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`폰트 로드 실패 (${path}: ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export type FillFonts = {
  /** 한글 포함 문자열용 */
  ko: Uint8Array;
  /** 베트남어·영문용 */
  latin: Uint8Array;
};

export async function loadFillFonts(origin: string): Promise<FillFonts> {
  if (!cachedKo) cachedKo = await fetchFont(origin, KO_PATH);
  if (!cachedLatin) cachedLatin = await fetchFont(origin, LATIN_PATH);
  return { ko: cachedKo, latin: cachedLatin };
}
