/**
 * AI 작문 도우미 (B4-5).
 *
 * 양식의 서술형 질문 + 학생의 essay 기초 데이터 → Claude 가 한국어 답변 작문.
 * 베트남어 번역도 옵션 (학생이 검토용).
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `당신은 한국 대학 입학 양식의 서술형 답변을 작성해주는 글쓰기 전문가입니다.

**역할**: 베트남 출신 유학생이 친근하게 입력한 sub-topic 답변들을, 한국 대학 양식의 격식 있는 질문에 맞춰 **하나의 완성된 답변으로 조합·재구성** 하세요.

**입력 구조**:
- 양식의 원 질문 (한국 대학이 묻는 격식 있는 한 문항. 여러 sub-topic 을 묶어 묻기도 함)
- 학생의 기초 데이터 (sub-topic 별로 학생이 친근하게 적은 답들. 표 형식)

**작성 원칙**:
1. **톤·문체**: 깔끔하고 단정한 한국어. 격식 있되 외국인 학생이 직접 쓴 듯한 진솔함. 화려한 미사여구·과장된 비유 금지. 입학사정관이 자연스럽게 읽을 수 있는 문장.
2. **조합 방식**:
   - 양식 질문이 여러 sub-topic 을 묶어 묻는 경우 (예: "자기 소개(취미·특기·성장과정·가족)"), 학생의 sub-topic 답변들을 자연스러운 문단 흐름으로 엮어 작성. 단순 나열 X — 본인 캐릭터가 일관되게 드러나도록 연결.
   - 양식이 단일 주제로 깊이 묻는 경우, 학생 답변의 핵심을 풀어서 한 가지 이야기로.
3. **사실 보존**: 학생 답변에 명시된 사실만 사용. 없는 경험·수치·이름 창작 금지. 학생이 빈칸으로 둔 부분은 무리하게 채우지 말 것.
4. **빈약한 입력 처리**: 기초 데이터가 부족하면 짧고 진솔하게. 길이를 위해 추상적 미사여구로 채우지 말 것.
5. **글자수**: 양식이 max_chars 명시 시 그 안에서 작성. 미명시면 양식 질문의 무게에 맞게 자연스러운 분량.
6. **출력 형식**: 마크다운·코드블록·헤더 사용 금지. 일반 문장 단락만. "답변:", "본인의 답변은 다음과 같습니다" 같은 메타 코멘트 출력 금지. 답변 본문만.
7. **베트남 학생 정체성**: "베트남 출신으로...", "한국으로 유학을 결심하면서..." 같이 자연스러운 배경 언급은 OK. 단 매번 반복하지 말고 양식 질문이 그걸 묻는 경우에만.

**예시**:
양식 원 질문: "자기 소개(취미, 특기, 인생관, 성장과정, 가족환경 등)를 자유롭게 서술하시오. (1000자 이내)"
학생 sub-topic 답변:
- 취미·특기: "사진 찍는 거 좋아함. 고2 때부터 일러스트도 시작"
- 본인 스타일: "차분한 편. 약속 잘 지키는 거 중요하게 생각"
- 성장과정: "호치민에서 태어남. 중학생 때 가족이 다낭으로 이사"
- 가족: "부모님, 여동생 1명. 부모님은 둘 다 회사원"

→ 작문 결과 (예):
"저는 베트남 호치민에서 태어나 중학생 때 가족과 함께 다낭으로 이주한 후 그곳에서 성장했습니다. 부모님은 회사원으로 일하시며, 여동생 한 명과 함께 살고 있습니다. 평소 차분한 성격이며 작은 약속이라도 지키는 것을 중요하게 생각합니다. 고등학교 시절부터 사진 찍는 것을 좋아하여 주변 풍경과 사람들의 일상을 기록해 왔고, 2학년 때부터는 일러스트 작업을 시작하여 시각적 표현에 대한 관심을 꾸준히 발전시켜 왔습니다."`;

export type EssayDraftInput = {
  questionKo: string;
  questionVi?: string;
  maxChars?: number;
  /** [{label_ko, value}] — 학생의 기초 데이터 */
  basisFacts: Array<{ label_ko: string; value: string }>;
  /** 학생 이름·기본 정보 (있으면 자연스러운 톤 만들 때 활용) */
  studentName?: string;
};

export type EssayDraftResult =
  | {
      ok: true;
      generated_text: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      model: string;
    }
  | {
      ok: false;
      error: string;
    };

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export async function generateEssayDraft(
  input: EssayDraftInput
): Promise<EssayDraftResult> {
  const factLines = input.basisFacts.length === 0
    ? "(기초 데이터 없음 — 학생에게 추가 정보 요청 권장)"
    : input.basisFacts
        .map((f) => `- ${f.label_ko}: ${f.value}`)
        .join("\n");

  const userText =
    `# 학생 정보\n` +
    (input.studentName ? `이름: ${input.studentName}\n\n` : "") +
    `# 기초 데이터 (학생이 유학센터에 제공한 정보)\n` +
    factLines +
    `\n\n# 양식 질문 (한국어)\n` +
    input.questionKo +
    (input.questionVi ? `\n\n베트남어 번역 (참고): ${input.questionVi}` : "") +
    (input.maxChars
      ? `\n\n글자수 제한: ${input.maxChars}자 이내`
      : "") +
    `\n\n위 질문에 대한 답변을 작성해주세요. 답변 텍스트만 출력. 다른 설명 없이.`;

  let response;
  try {
    response = await client().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
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

  return {
    ok: true,
    generated_text: textBlock.text.trim(),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
    },
    model: MODEL,
  };
}
