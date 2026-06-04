/**
 * 서버 사이드 언어 감지 + 번역 헬퍼.
 * Google Cloud Translation API v2 사용 — 월 50만자 무료.
 *
 * 사용처:
 * - /api/translate (기존)
 * - createConsultation / updateConsultation 서버 액션 (신규)
 */

/**
 * 베트남어 diacritic 문자 존재 여부로 언어 판단.
 * 베트남어 전용 문자 블록: Latin Extended Additional (U+1E00–U+1EFF) +
 * 베트남어 고유 đ/Đ (U+0111/U+0110).
 */
export function isVietnamese(text: string): boolean {
  return /[\u1e00-\u1eff\u0110\u0111]/.test(text);
}

/**
 * 한글이 텍스트의 주를 이루는지. 한글 블록 (U+AC00–U+D7AF) 문자가
 * 10% 이상이면 한국어로 간주.
 */
export function isMostlyKorean(text: string): boolean {
  const total = text.length;
  if (total === 0) return false;
  const hangul = (text.match(/[\uac00-\ud7af]/g) ?? []).length;
  return hangul / total >= 0.1;
}

/**
 * Google Translate v2 로 텍스트를 한국어로 번역.
 * API 키가 없으면 원문 그대로 반환 (서비스 degrade).
 */
export async function translateToKorean(text: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return text;
  }
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      target: "ko",
      format: "text",
    }),
  });
  if (!res.ok) {
    // 번역 실패 시에도 상담 저장 자체는 계속 — 원문만 반환
    return text;
  }
  const json = (await res.json()) as {
    data: { translations: { translatedText: string }[] };
  };
  return json.data.translations[0]?.translatedText ?? text;
}
