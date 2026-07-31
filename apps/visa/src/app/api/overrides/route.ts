/**
 * 편집값을 소스 데이터 파일에 직접 기록하는 개발용 API.
 *   body: { ko: {path→값}, vi: {path→값} } — 각각 overrides.json / overrides.vi.json 에 기록.
 *   (하위호환: 평탄한 {path→값} 만 오면 ko 로 간주.)
 *
 * 개발 서버(next dev)에서만 동작. 커밋·배포하면 모든 방문자에게 영구 반영.
 * 운영(배포) 환경에서는 파일 쓰기를 막는다(403).
 */
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const FILES: Record<string, string> = {
  ko: path.join(process.cwd(), "src", "data", "overrides.json"),
  vi: path.join(process.cwd(), "src", "data", "overrides.vi.json"),
};

const isMap = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "운영 환경에서는 소스 저장이 비활성화됩니다. 로컬 개발 서버에서 저장하세요." }, { status: 403 });
  }
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 파싱 실패" }, { status: 400 });
  }
  if (!isMap(data)) {
    return NextResponse.json({ error: "객체만 허용됩니다." }, { status: 400 });
  }

  // {ko, vi} 형태인지, 평탄한 맵(=ko)인지 판별
  const byLang: Record<string, Record<string, string>> = {};
  if (isMap(data.ko) || isMap(data.vi)) {
    if (isMap(data.ko)) byLang.ko = data.ko as Record<string, string>;
    if (isMap(data.vi)) byLang.vi = data.vi as Record<string, string>;
  } else {
    byLang.ko = data as Record<string, string>;
  }

  let total = 0;
  try {
    for (const [lang, file] of Object.entries(FILES)) {
      const map = byLang[lang];
      if (!isMap(map)) continue;
      await fs.writeFile(file, JSON.stringify(map, null, 2) + "\n", "utf8");
      total += Object.keys(map).length;
    }
  } catch (e) {
    return NextResponse.json({ error: `파일 쓰기 실패: ${String(e)}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: total });
}
