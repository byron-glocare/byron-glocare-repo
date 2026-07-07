/**
 * abroad 의 /api/admission/map-slots 호출 헬퍼.
 *   작성서류 빈칸(⟦S{n}⟧) → 표준데이터 AI 매핑.
 */

import "server-only";

// apex 는 www 로 307 리다이렉트됨 → 인증 헤더/본문 유실 방지 위해 www 로 직접 호출.
const DEFAULT_URL = "https://www.youstudyinkorea.com/api/admission/map-slots";

function endpointUrl(): string {
  const ext = process.env.EXTRACTION_API_URL?.trim();
  if (ext) return ext.replace(/\/api\/admission\/extract\/?$/, "/api/admission/map-slots");
  return DEFAULT_URL;
}

function internalToken(): string {
  const t = process.env.INTERNAL_API_TOKEN?.trim();
  if (!t) throw new Error("INTERNAL_API_TOKEN 환경변수 누락");
  return t;
}

export type SlotDataType = {
  key: string;
  label_ko: string;
  category: string;
  aliases?: string[];
};

export type CallMapSlotsResult =
  | { ok: true; mapping: Record<string, string>; usage: { input_tokens: number; output_tokens: number } }
  | { ok: false; error: string };

export async function callMapSlots(input: {
  markedText: string;
  slots: Array<{ index: number; hint: string }>;
  availableDataTypes: SlotDataType[];
}): Promise<CallMapSlotsResult> {
  let res: Response;
  try {
    res = await fetch(endpointUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken(),
      },
      body: JSON.stringify({
        marked_text: input.markedText,
        slots: input.slots,
        available_data_types: input.availableDataTypes,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `네트워크 오류: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `응답 파싱 실패 (HTTP ${res.status})` };
  }
  return json as CallMapSlotsResult;
}
