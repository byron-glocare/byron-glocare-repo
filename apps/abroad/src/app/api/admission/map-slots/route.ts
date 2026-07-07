/**
 * POST /api/admission/map-slots
 *
 * 작성서류 빈칸(⟦S{n}⟧) → 표준데이터 AI 매핑.
 * 호출 측: 글로케어 어드민 (X-Internal-Token 인증).
 *
 * 입력 (JSON):
 *   - marked_text: ⟦S{n}⟧ 마커가 박힌 양식 텍스트
 *   - slots: [{ index, hint }]
 *   - available_data_types: [{ key, label_ko, category, aliases? }]
 *
 * 출력: MapSlotsResult JSON
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  mapFormSlots,
  type SlotDataType,
} from "@/lib/admission/map-form-slots";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  marked_text?: string;
  slots?: Array<{ index?: number; hint?: string }>;
  available_data_types?: SlotDataType[];
};

export async function POST(req: NextRequest) {
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

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }

  if (typeof body.marked_text !== "string") {
    return NextResponse.json(
      { ok: false, error: "marked_text 가 필요합니다" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.slots)) {
    return NextResponse.json(
      { ok: false, error: "slots 배열이 필요합니다" },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.available_data_types)) {
    return NextResponse.json(
      { ok: false, error: "available_data_types 배열이 필요합니다" },
      { status: 400 }
    );
  }

  const slots = body.slots
    .filter((s) => typeof s?.index === "number")
    .map((s) => ({ index: s.index as number, hint: String(s.hint ?? "") }));

  const result = await mapFormSlots({
    markedText: body.marked_text,
    slots,
    availableDataTypes: body.available_data_types,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
