/**
 * POST /api/admissions/extract  (어드민 측)
 *
 * 변경: client 측 multipart 가 Next 16 Turbopack 에서 호환 X. JSON + base64 로 받음.
 * 받은 base64 → Buffer → File 재구성 → server-side 에서 multipart 로 본 저장소 endpoint 호출.
 *
 * 흐름:
 *   client (extract-form) → JSON POST → 이 Route Handler →
 *   server-side fetch (multipart) → glocare_homepage_abroad /api/admission/extract
 */

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  callExtractAdmission,
  type CallExtractResult,
} from "@/lib/admission/call-extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_SIZE = 40 * 1024 * 1024; // 40MB — 리플릿 PDF 대응
const MAX_HWP_SIZE = 30 * 1024 * 1024; // 30MB — HWP/HWPX

function isHwpName(name: string): boolean {
  const l = name.toLowerCase();
  return l.endsWith(".hwp") || l.endsWith(".hwpx");
}

type ExtractRequestBody = {
  file_base64?: string;
  file_name?: string;
  file_size?: number;
  university_name_ko?: string;
  term?: string;
  admission_category?: string;
};

export async function POST(req: NextRequest) {
  // 1. 어드민 세션 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다" } satisfies CallExtractResult,
      { status: 401 }
    );
  }

  // 2. JSON parsing
  let body: ExtractRequestBody;
  try {
    body = (await req.json()) as ExtractRequestBody;
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
      } satisfies CallExtractResult,
      { status: 400 }
    );
  }

  const {
    file_base64,
    file_name,
    file_size,
    university_name_ko,
    term,
    admission_category,
  } = body;

  if (!file_base64 || !file_name) {
    return NextResponse.json(
      { ok: false, error: "파일이 없습니다" } satisfies CallExtractResult,
      { status: 400 }
    );
  }

  const lower = file_name.toLowerCase();
  const isPdf = lower.endsWith(".pdf");
  const isHwp = isHwpName(lower);
  if (!isPdf && !isHwp) {
    return NextResponse.json(
      {
        ok: false,
        error: "지원 형식: .pdf / .hwp / .hwpx",
      } satisfies CallExtractResult,
      { status: 400 }
    );
  }
  const maxSize = isPdf ? MAX_PDF_SIZE : MAX_HWP_SIZE;
  if (typeof file_size === "number" && file_size > maxSize) {
    return NextResponse.json(
      {
        ok: false,
        error: `파일이 너무 큽니다 (${(file_size / 1024 / 1024).toFixed(1)}MB > ${maxSize / 1024 / 1024}MB)`,
      } satisfies CallExtractResult,
      { status: 413 }
    );
  }
  if (typeof university_name_ko !== "string" || !university_name_ko.trim()) {
    return NextResponse.json(
      { ok: false, error: "대학을 선택해주세요" } satisfies CallExtractResult,
      { status: 400 }
    );
  }
  if (
    typeof term !== "string" ||
    !/^\d{4}-(Spring|Fall|Summer|Winter|Year)$/.test(term)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "학기 형식 오류 (예: 2026-Spring)",
      } satisfies CallExtractResult,
      { status: 400 }
    );
  }

  // 3. base64 → File (Web standard, undici 호환)
  const buffer = Buffer.from(file_base64, "base64");
  const mime = isPdf
    ? "application/pdf"
    : lower.endsWith(".hwpx")
      ? "application/vnd.hancom.hwpx"
      : "application/x-hwp";
  const file = new File([buffer], file_name, { type: mime });

  // 4. 본 저장소 endpoint 호출 (server-side fetch multipart — 안정적)
  const result = await callExtractAdmission({
    file,
    universityNameKo: university_name_ko.trim(),
    term,
    admissionCategory:
      typeof admission_category === "string" && admission_category.trim()
        ? admission_category.trim()
        : undefined,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 422,
  });
}
