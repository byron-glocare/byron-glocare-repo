/**
 * 학생이 업로드한 제출서류(여권·성적표·가족관계증명서·잔고증명서·TOPIK 등)에서
 *   정보입력 표준데이터 값을 추출한다 (Claude Sonnet vision).
 *
 * 설계:
 *   - 추출만 한다. 저장은 호출측(서버액션)이 운영자 확인 후 수행.
 *   - 모델은 카탈로그(key/label/타입/옵션)를 받고, **읽어낼 수 있는 값만** 반환.
 *     추측 금지 — 모르면 생략. 날짜는 ISO(YYYY-MM-DD).
 *   - select/multi_select 는 카탈로그의 option value 중에서만 고른다.
 *
 * 비용: 시스템 프롬프트는 ephemeral 캐시. 문서(이미지/PDF)는 매번 다르므로 캐싱 X.
 *   입력 파일 수·크기는 호출측에서 캡.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

/** 추출 대상 카탈로그 1개 항목 (정보입력 데이터타입에서 추림) */
export type ExtractFieldSpec = {
  key: string;
  label_ko: string;
  input_type: string; // text | long_text | date | number | select | multi_select
  options?: Array<{ value: string; label_ko: string }> | null;
};

/** 모델에 넣을 입력 문서 1개 */
export type ExtractDocInput = {
  /** 서류명 — 모델이 어떤 문서인지 알도록 (예: "여권 사본", "고등학교 성적증명서") */
  label: string;
  mime: string;
  data: Buffer;
};

export type ExtractedField = {
  key: string;
  /** 추출값 — 문자열/숫자. date 는 YYYY-MM-DD 문자열, multi_select 는 string[] */
  value: string | number | string[];
  /** 어느 문서에서 읽었는지 (서류명) */
  source: string | null;
  /** 모델 신뢰도 */
  confidence: "high" | "medium" | "low";
};

export type ExtractStudentDataResult =
  | {
      ok: true;
      fields: ExtractedField[];
      raw: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    }
  | { ok: false; error: string; raw?: string };

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

const SYSTEM_PROMPT = `당신은 한국 대학에 지원하는 베트남 학생의 제출서류를 읽고, 입학 지원에 필요한 표준 데이터를 추출하는 전문가입니다.

# 입력
- 학생이 업로드한 서류 이미지/PDF (여권, 고등학교 졸업·성적증명서, 가족관계증명서, 잔고증명서, TOPIK 성적표 등)
- 채워야 할 데이터 항목 카탈로그 (key / 한국어 라벨 / 타입 / 선택지)

# 규칙
1. **읽어낼 수 있는 값만** 추출하세요. 문서에 없거나 확실하지 않으면 **생략**(추측·창작 절대 금지).
2. 출력은 반드시 아래 JSON 형식 하나. 다른 텍스트(설명·마크다운) 금지.
3. **날짜**는 ISO 8601 (YYYY-MM-DD). 여권 등에서 DD MMM YYYY 형식이면 변환.
4. **숫자**(number 타입)는 단위·콤마 제거한 정수/실수만.
5. **select / multi_select** 타입은 반드시 카탈로그에 주어진 option **value** 중에서만 고르세요. 매칭되는 게 없으면 생략.
6. **이름**: 여권의 로마자 표기는 full_name_en(영문 이름)에. 한국식/베트남식/한자 이름은 해당 문서에 있을 때만.
7. **여권 번호·발급일·만료일**, **생년월일**, **성별**, **국적**은 여권에서 정확히.
8. confidence: 또렷이 읽힘=high, 일부 흐림/추론=medium, 불확실=low. low 도 포함하되 표시.
9. 베트남 학생 기준 — 한국식 이름이 없으면 비워두세요(만들지 말 것).

# 출력 JSON 형식
\`\`\`json
{
  "fields": [
    { "key": "passport_no", "value": "C1234567", "source": "여권 사본", "confidence": "high" },
    { "key": "birth_date", "value": "2005-03-14", "source": "여권 사본", "confidence": "high" },
    { "key": "gender", "value": "male", "source": "여권 사본", "confidence": "high" }
  ]
}
\`\`\`

위 형식의 단일 JSON 만 출력하세요.`;

function catalogText(fields: ExtractFieldSpec[]): string {
  const lines = fields.map((f) => {
    let line = `- ${f.key} | ${f.label_ko} | ${f.input_type}`;
    if (
      (f.input_type === "select" || f.input_type === "multi_select") &&
      f.options &&
      f.options.length > 0
    ) {
      const opts = f.options
        .map((o) => `${o.value}(${o.label_ko})`)
        .join(", ");
      line += ` | 선택지: ${opts}`;
    }
    return line;
  });
  return lines.join("\n");
}

/** PDF / 이미지 → Anthropic content block. 지원 안 하면 null */
function docToBlock(
  doc: ExtractDocInput
): Anthropic.ContentBlockParam | null {
  const mime = doc.mime.toLowerCase();
  const b64 = doc.data.toString("base64");
  if (mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: b64 },
    };
  }
  if (
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/webp" ||
    mime === "image/gif"
  ) {
    return {
      type: "image",
      source: { type: "base64", media_type: mime, data: b64 },
    };
  }
  return null;
}

/**
 * 업로드 서류들에서 표준데이터 값을 추출한다.
 *   docs 가 비었거나 지원되는 형식이 하나도 없으면 ok:true + 빈 배열.
 */
export async function extractStudentData(input: {
  docs: ExtractDocInput[];
  catalog: ExtractFieldSpec[];
}): Promise<ExtractStudentDataResult> {
  const { docs, catalog } = input;

  // 문서 블록 + 라벨 텍스트 구성 (각 문서 앞에 "[서류명]" 텍스트로 출처 명시)
  const content: Anthropic.ContentBlockParam[] = [];
  let usableDocs = 0;
  for (const doc of docs) {
    const block = docToBlock(doc);
    if (!block) continue;
    content.push({ type: "text", text: `[서류: ${doc.label}]` });
    content.push(block);
    usableDocs += 1;
  }

  if (usableDocs === 0) {
    return { ok: true, fields: [], raw: "", usage: { input_tokens: 0, output_tokens: 0 } };
  }

  content.push({
    type: "text",
    text:
      `# 채워야 할 데이터 카탈로그\n` +
      catalogText(catalog) +
      `\n\n위 서류들을 읽고, 카탈로그 항목 중 **읽어낼 수 있는 값만** 추출해 JSON 으로 출력하세요. ` +
      `select/multi_select 는 주어진 value 중에서만. 모르면 생략.`,
  });

  let response: Anthropic.Message;
  try {
    response = await client().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    return {
      ok: false,
      error: `AI 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "응답에 텍스트가 없습니다." };
  }
  const raw = textBlock.text.trim();
  const jsonStr = stripCodeFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      error: `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
      raw,
    };
  }

  const fields = sanitizeFields(parsed, catalog);

  return {
    ok: true,
    fields,
    raw,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

function stripCodeFence(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  return fenced ? fenced[1].trim() : s;
}

/** 모델 출력 → 카탈로그에 존재하는 key·타입에 맞는 값만 남김 */
function sanitizeFields(
  parsed: unknown,
  catalog: ExtractFieldSpec[]
): ExtractedField[] {
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  const rawFields =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { fields?: unknown }).fields)
      ? ((parsed as { fields: unknown[] }).fields)
      : [];

  const out: ExtractedField[] = [];
  for (const rf of rawFields) {
    if (!rf || typeof rf !== "object") continue;
    const r = rf as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key : null;
    if (!key) continue;
    const spec = byKey.get(key);
    if (!spec) continue; // 카탈로그에 없는 key 버림

    const coerced = coerceValue(r.value, spec);
    if (coerced === null) continue;

    const confidence =
      r.confidence === "high" || r.confidence === "medium" || r.confidence === "low"
        ? r.confidence
        : "medium";
    const source = typeof r.source === "string" ? r.source : null;

    out.push({ key, value: coerced, source, confidence });
  }
  return out;
}

/** 타입별 값 정규화 — 맞지 않으면 null(버림) */
function coerceValue(
  value: unknown,
  spec: ExtractFieldSpec
): string | number | string[] | null {
  if (value === null || value === undefined || value === "") return null;

  switch (spec.input_type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).replace(/[, ]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    case "multi_select": {
      const arr = Array.isArray(value) ? value : [value];
      const allowed = new Set((spec.options ?? []).map((o) => o.value));
      const picked = arr.map(String).filter((v) => allowed.has(v));
      return picked.length > 0 ? picked : null;
    }
    case "select": {
      const v = String(value);
      const allowed = new Set((spec.options ?? []).map((o) => o.value));
      return allowed.has(v) ? v : null;
    }
    case "date": {
      const v = String(value).trim();
      // YYYY-MM-DD 만 허용 (모델이 변환하도록 프롬프트로 강제)
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    }
    default: {
      // text / long_text 등
      const v = String(value).trim();
      return v ? v : null;
    }
  }
}
