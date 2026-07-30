/**
 * 편집값을 소스 데이터 파일(src/data/overrides.json)에 직접 기록하는 개발용 API.
 *
 * 개발 서버(next dev)에서만 동작. 여기에 저장하면 편집값이 파일로 커밋·배포되어
 * 모든 방문자에게 영구 반영된다. 운영(배포) 환경에서는 파일 쓰기를 막는다(403).
 */
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const FILE = path.join(process.cwd(), "src", "data", "overrides.json");

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
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return NextResponse.json({ error: "객체(path→값 맵)만 허용됩니다." }, { status: 400 });
  }
  try {
    await fs.writeFile(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
  } catch (e) {
    return NextResponse.json({ error: `파일 쓰기 실패: ${String(e)}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: Object.keys(data as object).length });
}
