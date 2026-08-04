/**
 * 편집값(overrides) 로드·저장 API.
 *   - Supabase env(NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) 이 있으면 DB(study_visa_overrides) 사용.
 *     → 운영(배포)에서도 편집→저장→라이브 반영. center(youstudyinkorea)는 같은 DB를 읽어 즉시 반영.
 *   - env 가 없으면(로컬 dev) 소스 파일(overrides.json/.vi.json) 을 읽고/쓴다.
 *
 * GET  → { ko:{...}, vi:{...} }
 * POST { ko, vi } (또는 평탄한 맵=ko) → upsert
 */
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import baseKo from "@/data/overrides.json";
import baseVi from "@/data/overrides.vi.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 커밋된 base(최신 배포) 위에 DB(라이브 편집)를 얹는다: 새 키는 base, 편집분은 DB 우선.
const BASE: Record<string, Record<string, string>> = { ko: baseKo as Record<string, string>, vi: baseVi as Record<string, string> };

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }) : null;
const TABLE = "study_visa_overrides";

const FILES: Record<string, string> = {
  ko: path.join(process.cwd(), "src", "data", "overrides.json"),
  vi: path.join(process.cwd(), "src", "data", "overrides.vi.json"),
};

const isMap = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function GET() {
  if (sb) {
    const { data, error } = await sb.from(TABLE).select("lang,data");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const db: Record<string, Record<string, string>> = {};
    for (const r of data ?? []) db[(r as { lang: string }).lang] = ((r as { data: unknown }).data as Record<string, string>) ?? {};
    const out = { ko: { ...BASE.ko, ...(db.ko ?? {}) }, vi: { ...BASE.vi, ...(db.vi ?? {}) } };
    return NextResponse.json(out, { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120" } });
  }
  // dev 폴백: 소스 파일
  const out: Record<string, unknown> = { ko: {}, vi: {} };
  for (const lang of ["ko", "vi"] as const) {
    try { out[lang] = JSON.parse(await fs.readFile(FILES[lang], "utf8")); } catch {}
  }
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  let data: unknown;
  try { data = await req.json(); } catch { return NextResponse.json({ error: "JSON 파싱 실패" }, { status: 400 }); }
  if (!isMap(data)) return NextResponse.json({ error: "객체만 허용됩니다." }, { status: 400 });

  const byLang: Record<string, Record<string, string>> = {};
  if (isMap(data.ko) || isMap(data.vi)) {
    if (isMap(data.ko)) byLang.ko = data.ko as Record<string, string>;
    if (isMap(data.vi)) byLang.vi = data.vi as Record<string, string>;
  } else {
    byLang.ko = data as Record<string, string>;
  }

  if (sb) {
    const rows = Object.entries(byLang).map(([lang, d]) => ({ lang, data: d }));
    const { error } = await sb.from(TABLE).upsert(rows, { onConflict: "lang" });
    if (error) return NextResponse.json({ error: `DB 저장 실패: ${error.message}` }, { status: 500 });
    const count = rows.reduce((n, r) => n + Object.keys(r.data).length, 0);
    return NextResponse.json({ ok: true, count, target: "db" });
  }

  // Supabase 미설정 상태에서 운영이면 저장 불가(파일 쓰기는 dev 만).
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "저장소(Supabase env)가 설정되지 않았습니다. Vercel 환경변수를 확인하세요." }, { status: 503 });
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
  return NextResponse.json({ ok: true, count: total, target: "file" });
}
