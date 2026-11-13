/**
 * POST /api/admissions/specs/[id]/refresh-extract — 저장된 모집요강 원본을 다시 AI 추출한다.
 *   파일은 저장소에서 서버가 직접 받아 추출 API 로 넘긴다(브라우저 업로드 없음).
 *   결과만 돌려준다 — DB 는 바꾸지 않는다. 적용은 화면에서 고른 항목만(applySpecRefreshAction).
 *   본문: { term?: "2027-Spring" } — 추출 힌트.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { callExtractAdmission, type CallExtractResult } from "@/lib/admission/call-extract";

export const runtime = "nodejs";
export const maxDuration = 300;

const SOURCE_URL_RE = /^https:\/\/[^/]+\/storage\/v1\/object\/public\/admission-form-files\/admission-sources\//;

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error } satisfies CallExtractResult, { status });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user)) return fail("권한이 없습니다", 401);

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { term?: string };
  const term = typeof body.term === "string" && /^\d{4}-(Spring|Fall|Summer|Winter|Year)$/.test(body.term) ? body.term : "";

  const { data: spec } = await supabase
    .from("study_admission_specs")
    .select("id, university_id, admission_category, source_file_url")
    .eq("id", id)
    .maybeSingle();
  if (!spec) return fail("모집요강을 찾지 못했습니다", 404);
  const url = spec.source_file_url ?? "";
  if (!SOURCE_URL_RE.test(url)) return fail("보관된 원본 파일이 없습니다. 먼저 원본을 올려 주세요.", 400);

  const { data: uni } = await supabase.from("universities").select("name_ko").eq("id", spec.university_id).maybeSingle();

  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return fail(`원본 파일을 받지 못했습니다 (${res?.status ?? "네트워크 오류"})`, 502);
  const name = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "source.pdf");
  const lower = name.toLowerCase();
  const mime = lower.endsWith(".pdf")
    ? "application/pdf"
    : lower.endsWith(".hwpx")
      ? "application/vnd.hancom.hwpx"
      : lower.endsWith(".hwp")
        ? "application/x-hwp"
        : res.headers.get("content-type") || "application/octet-stream";
  const file = new File([await res.arrayBuffer()], name, { type: mime });

  const result = await callExtractAdmission({
    file,
    universityNameKo: uni?.name_ko ?? "",
    term,
    admissionCategory: spec.admission_category?.trim() || undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
