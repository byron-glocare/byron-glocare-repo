/**
 * 양식(docx) 텍스트 → "서술형 작성 문서인지 + 문항 추출" AI 분석.
 *   업로드/검수 시 자기소개서·학업계획서 등을 자동 인식하고 문항명을 뽑아준다.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1500;

export type DetectedSection = {
  label: string;
  prompt: string;
  basis_keys: string[];
};

export type DetectEssayResult =
  | { ok: true; is_essay: boolean; sections: DetectedSection[] }
  | { ok: false; error: string };

const SYSTEM = `당신은 한국 대학 입학서류 분석가입니다. 주어진 문서 텍스트를 보고 두 가지를 판단하세요.

1) is_essay: 이 문서가 **서술형 작성 문서**(자기소개서·학업계획서·수학계획서·지원동기서·자기소개 등 학생이 직접 글을 써야 하는 문서)이면 true. 단순 정보 기입표(이름·주소·연락처 등 빈칸 채우기 위주)이면 false.

2) sections: 서술형이면 그 안의 **작성 문항**들을 추출. 각 문항 =
   - label: 문항명(짧게. 예: "지원동기", "학업계획", "자기소개").
   - prompt: 작성 지침(문서에 적힌 질문/안내를 1~2문장으로 요약. 글자수 제한이 있으면 포함).
   - basis_keys: 이 글 작성에 참고할 표준데이터 — **아래 '표준데이터 목록'의 key 중에서만** 고를 것(없으면 빈 배열).

규칙: 표준데이터 목록에 없는 key 는 절대 넣지 말 것. 서술형이 아니면 sections 는 빈 배열.
출력은 아래 JSON 한 개만. 설명·마크다운·코드블록 금지.
{"is_essay": true, "sections": [{"label": "", "prompt": "", "basis_keys": []}]}`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const key = (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export async function detectEssay(input: {
  text: string;
  catalog: Array<{ key: string; label_ko: string }>;
}): Promise<DetectEssayResult> {
  const catKeys = new Set(input.catalog.map((c) => c.key));
  const userText =
    `# 표준데이터 목록 (key: 라벨)\n` +
    input.catalog.map((c) => `${c.key}: ${c.label_ko}`).join("\n") +
    `\n\n# 문서 텍스트\n` +
    input.text.slice(0, 14000);

  let response;
  try {
    response = await client().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userText }],
    });
  } catch (e) {
    return { ok: false, error: `AI 호출 실패: ${e instanceof Error ? e.message : String(e)}` };
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return { ok: false, error: "AI 응답이 비었습니다." };

  let parsed: { is_essay?: boolean; sections?: DetectedSection[] };
  try {
    const m = block.text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : block.text);
  } catch {
    return { ok: false, error: "AI 응답을 해석하지 못했습니다." };
  }

  const sections: DetectedSection[] = Array.isArray(parsed.sections)
    ? parsed.sections.map((s) => ({
        label: String(s.label ?? "").trim(),
        prompt: String(s.prompt ?? "").trim(),
        basis_keys: Array.isArray(s.basis_keys)
          ? s.basis_keys.filter((k) => catKeys.has(k))
          : [],
      }))
    : [];
  return { ok: true, is_essay: parsed.is_essay === true, sections };
}
