/**
 * POST /api/admission/analyze-form  (B4-7)
 *
 * 양식 파일을 분석해서 essay_questions + required_data_type_keys 자동 추출.
 *
 * 호출 측: 글로케어 어드민 (X-Internal-Token 인증).
 *
 * 입력 (JSON):
 *   - file_url: Supabase Storage 공개 URL (admission-form-files 버킷)
 *   - file_name: 원본 파일명 (확장자로 형식 판별)
 *   - available_data_types: [{key, label_ko, category, is_essay_basis}] — 어드민의 표준 카탈로그
 *
 * 출력: analyze-form.ts 의 AnalyzeFormResult JSON
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  analyzeFormFile,
  type AvailableDataType,
} from "@/lib/admission/analyze-form";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 40 * 1024 * 1024;

type RequestBody = {
  file_url?: string;
  file_name?: string;
  available_data_types?: AvailableDataType[];
};

export async function POST(req: NextRequest) {
  // 인증
  const token = req.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_API_TOKEN not configured" },
      { status: 500 }
    );
  }
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 본문 파싱
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 400 }
    );
  }

  if (!body.file_url || typeof body.file_url !== "string") {
    return NextResponse.json(
      { ok: false, error: "file_url 이 필요합니다" },
      { status: 400 }
    );
  }
  if (!body.file_name || typeof body.file_name !== "string") {
    return NextResponse.json(
      { ok: false, error: "file_name 이 필요합니다" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.available_data_types)) {
    return NextResponse.json(
      { ok: false, error: "available_data_types 배열이 필요합니다" },
      { status: 400 }
    );
  }

  // 파일 다운로드 (Supabase Storage public URL)
  let fileBuffer: Buffer;
  try {
    const res = await fetch(body.file_url);
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `파일 다운로드 실패: HTTP ${res.status}`,
        },
        { status: 502 }
      );
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "파일이 너무 큽니다 (40MB 초과)" },
        { status: 413 }
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "파일이 너무 큽니다 (40MB 초과)" },
        { status: 413 }
      );
    }
    fileBuffer = Buffer.from(arrayBuffer);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `네트워크 오류: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 502 }
    );
  }

  const result = await analyzeFormFile({
    fileBuffer,
    fileName: body.file_name,
    availableDataTypes: body.available_data_types,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
