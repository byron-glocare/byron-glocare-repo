import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/translate
 * Body: { text: string, target?: "ko" | "vi" = "ko", source?: "auto" | "vi" | "ko" = "auto" }
 * 반환: { translation: string }
 *
 * Google Cloud Translation API v2 사용 (무료 한도: 월 500,000자).
 * API 키는 서버 환경변수 GOOGLE_TRANSLATE_API_KEY 로만 접근.
 * 인증 사용자만 호출 가능.
 */
export async function POST(request: Request) {
  // 인증 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_TRANSLATE_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  let body: { text?: string; target?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식 오류" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json(
      { error: "text 필드가 비어있습니다." },
      { status: 400 }
    );
  }

  const target = body.target === "vi" ? "vi" : "ko";
  const source = body.source === "ko" || body.source === "vi" ? body.source : undefined;

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const payload: Record<string, string> = {
    q: text,
    target,
    format: "text",
  };
  if (source) payload.source = source;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json(
      { error: `번역 API 오류 (${res.status}): ${errText}` },
      { status: 502 }
    );
  }

  type GoogleTranslateResponse = {
    data: {
      translations: { translatedText: string; detectedSourceLanguage?: string }[];
    };
  };
  const json = (await res.json()) as GoogleTranslateResponse;
  const translation = json.data.translations[0]?.translatedText;
  if (!translation) {
    return NextResponse.json({ error: "번역 결과가 비어있습니다." }, { status: 502 });
  }

  return NextResponse.json({
    translation,
    detectedSourceLanguage: json.data.translations[0]?.detectedSourceLanguage,
  });
}
