/**
 * 작성서류(docx) 빈칸 → 표준데이터 AI 매핑 (빈칸 클릭 배치 자동화).
 *
 * 어드민이 문서에 ⟦S{n}⟧ 마커를 박아 텍스트로 추출한 뒤, 빈칸 목록·표준 카탈로그와
 * 함께 보낸다. Claude 가 각 빈칸(⟦S{n}⟧)에 어떤 표준데이터가 들어가야 하는지 판단해
 * { slot번호: 카탈로그키 } 매핑을 돌려준다.
 *
 * 호출 측: 글로케어 어드민 (X-Internal-Token 인증) → /api/admission/map-slots.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

export type SlotDataType = {
  key: string;
  label_ko: string;
  category: string;
  aliases?: string[];
};

export type MapSlotsInput = {
  /** ⟦S{n}⟧ 마커가 박힌 양식 텍스트 (문맥 파악용) */
  markedText: string;
  /** 매핑 대상 빈칸 목록 (앞 라벨 힌트 포함) */
  slots: Array<{ index: number; hint: string }>;
  availableDataTypes: SlotDataType[];
};

export type MapSlotsResult =
  | {
      ok: true;
      /** { "슬롯번호": "카탈로그키" } — 매핑 안 된 빈칸은 생략 */
      mapping: Record<string, string>;
      usage: { input_tokens: number; output_tokens: number };
    }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `당신은 한국 대학 외국인 입학 양식의 빈칸을 표준데이터 항목에 매핑하는 전문가입니다.

# 입력
- 양식 텍스트: 빈칸 위치가 \`⟦S숫자⟧\` 마커로 표시됨 (예: "성명 ⟦S3⟧", "생년월일 ⟦S5⟧").
- 빈칸 목록: 각 빈칸의 번호와 바로 앞 라벨(hint).
- 표준 데이터 카탈로그: 이 키들 중에서만 골라야 함.

# 작업
각 빈칸에 **어떤 표준데이터가 들어가야 하는지** 판단해서 { "빈칸번호": "카탈로그키" } 로 매핑.

# 출력 형식
**반드시 단일 JSON 만** 출력. 다른 텍스트·설명·코드블록 금지.
{ "mapping": { "3": "full_name_ko", "5": "birth_date", "8": "passport_no" } }

# 규칙
1. **의미 매칭**: 라벨이 카탈로그와 정확히 같지 않아도 의미가 통하면 매핑.
   예) "성명/이름" → full_name_ko, "생년월일/출생일" → birth_date, "여권번호" → passport_no,
   "주소/현주소/거주지" → residence_addr_vn, "연락처/전화" → phone, "학교명" → highschool_name.
2. **별칭**: 카탈로그의 \`(별칭: …)\` 표현도 같은 뜻이면 그 키로 매핑.
3. **이미지 칸**: "사진/증명사진" → 사진 키, "서명/자필서명" → 서명 키, "도장/인" → 도장 키 (카탈로그에 있으면).
4. **확신 없으면 생략**: 어느 키에도 의미가 안 맞으면 그 빈칸은 mapping 에서 빼라 (억지 매핑 금지).
   날짜 서명란(작성일 등), 안내문, 표 제목 같은 건 매핑하지 말 것.
5. **카탈로그에 있는 key 만** 사용. 없는 key 지어내지 말 것.
6. 같은 표준데이터가 여러 빈칸에 반복되면 각 빈칸에 모두 매핑해도 됨.`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

function formatCatalog(types: SlotDataType[]): string {
  const byCat = new Map<string, SlotDataType[]>();
  for (const t of types) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category)!.push(t);
  }
  const lines: string[] = [];
  for (const [cat, items] of byCat.entries()) {
    lines.push(`## ${cat}`);
    for (const t of items) {
      const aliasPart =
        t.aliases && t.aliases.length > 0
          ? ` (별칭: ${t.aliases.join(", ")})`
          : "";
      lines.push(`- \`${t.key}\` — ${t.label_ko}${aliasPart}`);
    }
  }
  return lines.join("\n");
}

function stripCodeFence(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  return fenced ? fenced[1].trim() : s;
}

export async function mapFormSlots(
  input: MapSlotsInput
): Promise<MapSlotsResult> {
  if (input.slots.length === 0) {
    return { ok: true, mapping: {}, usage: { input_tokens: 0, output_tokens: 0 } };
  }

  const catalogText = formatCatalog(input.availableDataTypes);
  const slotList = input.slots
    .map((s) => `- ⟦S${s.index}⟧ (앞 라벨: ${s.hint || "(없음)"})`)
    .join("\n");

  // 텍스트가 너무 길면 자름 (토큰 보호)
  const marked = input.markedText.slice(0, 24000);

  let response;
  try {
    response = await client().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `# 표준 데이터 카탈로그 (이 키들만 사용)\n\n${catalogText}\n\n` +
                `# 양식 텍스트 (⟦S번호⟧ = 빈칸)\n\n---FORM START---\n${marked}\n---FORM END---\n\n` +
                `# 매핑할 빈칸 목록\n${slotList}\n\n` +
                `# 작업\n각 빈칸에 들어갈 표준데이터 키를 { "mapping": { "번호": "키" } } JSON 으로만 출력.`,
            },
          ],
        },
      ],
    });
  } catch (e) {
    return {
      ok: false,
      error: `Claude 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "응답에 텍스트 없음" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(textBlock.text.trim()));
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const rawMap = (parsed as { mapping?: Record<string, unknown> })?.mapping ?? {};
  const validKeys = new Set(input.availableDataTypes.map((t) => t.key));
  const validSlots = new Set(input.slots.map((s) => String(s.index)));
  const mapping: Record<string, string> = {};
  for (const [slot, key] of Object.entries(rawMap)) {
    if (
      typeof key === "string" &&
      validKeys.has(key) &&
      validSlots.has(String(slot))
    ) {
      mapping[String(slot)] = key;
    }
  }

  return {
    ok: true,
    mapping,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
