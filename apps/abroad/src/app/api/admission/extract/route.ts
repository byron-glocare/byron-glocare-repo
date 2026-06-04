/**
 * POST /api/admission/extract
 *
 * 모집요강 PDF / HWP / HWPX → 구조화 JSON 추출.
 *   - 호출 측: 글로케어 내부 어드민 (`glocare_customer_management`, 별도 저장소)
 *   - 인증: 헤더 `X-Internal-Token` = `process.env.INTERNAL_API_TOKEN`
 *     (Supabase Auth cross-origin 회피 + thin client 패턴)
 *   - 입력: multipart/form-data — file (.pdf / .hwp / .hwpx) + university_name_ko + term + admission_category(옵션)
 *   - 출력: extract.ts 의 ExtractResult JSON
 *
 * 처리 분기:
 *   - PDF: Sonnet vision (PDF document input)
 *   - HWP/HWPX: @ssabrojs/hwpxjs 로 markdown 추출 → Sonnet text input
 *
 * 본 endpoint 는 DB insert 하지 않음. 호출 측이 결과를 받아 검수 UI 에 표시 → 운영자 수정 → 승인 시 DB insert.
 */

import { NextResponse, type NextRequest } from "next/server";

import { extractAdmissionSpec } from "@/lib/admission/extract";
import {
  extractHwpMarkdown,
  isHwpFileName,
} from "@/lib/admission/hwp-to-text";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel: PDF + Sonnet 호출 시간 여유

const MAX_PDF_SIZE = 40 * 1024 * 1024; // 40MB — 리플릿 PDF 대응. Anthropic API 자체 한계 ~32MB
const MAX_HWP_SIZE = 30 * 1024 * 1024; // 30MB — HWP/HWPX (텍스트 변환 메모리 여유)

export async function POST(req: NextRequest) {
  // 1. 인증
  const token = req.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_API_TOKEN not configured on server" },
      { status: 500 }
    );
  }
  if (!token || token !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. multipart 파싱
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "multipart/form-data 형식이 필요합니다" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const universityNameKo = form.get("university_name_ko");
  const term = form.get("term");
  const admissionCategory = form.get("admission_category");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "file (.pdf / .hwp / .hwpx) 가 필요합니다" },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "빈 파일" },
      { status: 400 }
    );
  }

  const lower = file.name.toLowerCase();
  const isPdf = lower.endsWith(".pdf");
  const isHwp = isHwpFileName(lower);

  if (!isPdf && !isHwp) {
    return NextResponse.json(
      {
        ok: false,
        error: "지원 형식: .pdf / .hwp / .hwpx",
      },
      { status: 400 }
    );
  }

  const maxSize = isPdf ? MAX_PDF_SIZE : MAX_HWP_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json(
      {
        ok: false,
        error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > ${maxSize / 1024 / 1024}MB)`,
      },
      { status: 413 }
    );
  }

  if (typeof universityNameKo !== "string" || universityNameKo.trim() === "") {
    return NextResponse.json(
      { ok: false, error: "university_name_ko 가 필요합니다" },
      { status: 400 }
    );
  }
  if (typeof term !== "string" || !/^\d{4}-(Spring|Fall|Summer|Winter|Year)$/.test(term)) {
    return NextResponse.json(
      {
        ok: false,
        error: "term 형식 오류 (예: 2026-Spring / 2026-Fall / 2026-Year)",
      },
      { status: 400 }
    );
  }

  // 3. 파일 → Buffer
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // 4. 형식별 분기
  if (isHwp) {
    const hwpResult = await extractHwpMarkdown(fileBuffer);
    if (!hwpResult.ok) {
      return NextResponse.json(
        { ok: false, error: hwpResult.error },
        { status: 422 }
      );
    }
    const result = await extractAdmissionSpec({
      source: {
        kind: "markdown",
        markdown: hwpResult.markdown,
        sourceFormat: hwpResult.format,
      },
      universityNameKo: universityNameKo.trim(),
      term,
      admissionCategory:
        typeof admissionCategory === "string" && admissionCategory.trim()
          ? admissionCategory.trim()
          : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  // PDF
  const result = await extractAdmissionSpec({
    source: { kind: "pdf", pdfBuffer: fileBuffer },
    universityNameKo: universityNameKo.trim(),
    term,
    admissionCategory:
      typeof admissionCategory === "string" && admissionCategory.trim()
        ? admissionCategory.trim()
        : undefined,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 422,
  });
}
