/**
 * 한국어 → 베트남어 일괄 번역 (모집요강 PDF 베트남어판 빈 칸 채우기, KAN-40).
 *   결과는 화면 입력 칸에만 채운다 — 사람이 확인·수정한 뒤 저장한다.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const MODEL = "claude-opus-5-5";

const SYSTEM = `한국 대학의 외국인 유학생 모집요강에 실린 짧은 문구를 베트남어로 옮긴다. 읽는 사람은 한국 유학을 준비하는 베트남 학생과 부모다.
- 각 항목의 "where" 는 그 문구가 어디에 쓰이는지(학과 이름, 장학금 조건, 서류 이름 등)다. 그 쓰임에 맞게 옮긴다.
- 뜻을 정확히 옮기고 자연스러운 베트남어로 쓴다. 덧붙이거나 줄이지 않는다.
- 숫자·퍼센트·금액·TOPIK 급수·영문 약어는 그대로 둔다. 금액 단위 '원'은 'won'.
- 이미 베트남어가 섞여 있으면(예: "입학원서 _ Đơn nhập học") 베트남어 부분을 살려 자연스러운 베트남어 하나로 만든다.
- 입력과 같은 개수·순서로 돌려준다.`;

const SCHEMA = {
  type: "object",
  properties: { items: { type: "array", items: { type: "string" } } },
  required: ["items"],
  additionalProperties: false,
} as const;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export async function translateTextsToVi(
  items: Array<{ where: string; text: string }>
): Promise<{ ok: true; items: string[] } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: true, items: [] };
  try {
    const response = await client().messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: jsonSchemaOutputFormat(SCHEMA) },
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify({ items }) }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "AI 가 번역을 거절했습니다." };
    const out = response.parsed_output?.items;
    if (!out || out.length !== items.length) return { ok: false, error: "AI 번역 결과 개수가 맞지 않습니다. 다시 시도해 주세요." };
    return { ok: true, items: out.map((s) => String(s).trim()) };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "AI 사용량이 많습니다. 잠시 뒤 다시 시도해 주세요." };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `AI 호출 실패 (${e.status}): ${e.message}` };
    return { ok: false, error: `AI 호출 실패: ${e instanceof Error ? e.message : String(e)}` };
  }
}
