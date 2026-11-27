/**
 * 장학금 문구 한국어 → 베트남어 번역 (모집요강 PDF 베트남어판용, KAN-39).
 *   장학금마다 이름·조건·혜택 설명·기간·메모를 한 번에 번역한다. 빈 칸은 빈 칸으로 돌려준다.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const MODEL = "claude-opus-5-5";

export const SCHOLARSHIP_TEXT_FIELDS = ["name", "condition", "benefit", "duration", "notes"] as const;
export type ScholarshipText = Record<(typeof SCHOLARSHIP_TEXT_FIELDS)[number], string>;

const SYSTEM = `한국 대학의 외국인 유학생 모집요강에 실린 장학금 문구를 베트남어로 옮긴다. 읽는 사람은 한국 유학을 준비하는 베트남 학생과 부모다.
- 뜻을 정확히 옮기고, 베트남 학생이 바로 이해하는 자연스러운 표현을 쓴다. 덧붙이거나 줄이지 않는다.
- 숫자·퍼센트·금액·TOPIK 급수는 그대로 둔다. 금액 단위 '원'은 'won'.
- 대학·장학금 고유 명칭은 뜻을 살려 옮긴다.
- 입력이 빈 칸이면 빈 칸("")으로 돌려준다.
- 입력과 같은 개수·순서로 돌려준다.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          condition: { type: "string" },
          benefit: { type: "string" },
          duration: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name", "condition", "benefit", "duration", "notes"],
        additionalProperties: false,
      },
    },
  },
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

export async function translateScholarshipsToVi(
  items: ScholarshipText[]
): Promise<{ ok: true; items: ScholarshipText[] } | { ok: false; error: string }> {
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
    if (!out || out.length !== items.length) return { ok: false, error: "AI 번역 결과가 맞지 않습니다. 다시 시도해 주세요." };
    return { ok: true, items: out as ScholarshipText[] };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "AI 사용량이 많습니다. 잠시 뒤 다시 시도해 주세요." };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `AI 호출 실패 (${e.status}): ${e.message}` };
    return { ok: false, error: `AI 호출 실패: ${e instanceof Error ? e.message : String(e)}` };
  }
}
