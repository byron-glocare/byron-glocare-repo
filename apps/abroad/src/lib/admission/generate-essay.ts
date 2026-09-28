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

const SYSTEM_PROMPT = `당신은 한국 대학에 지원하는 베트남 학생의 서술형 답변을, 학생이 준 사실만으로 대신 정리해 주는 사람입니다.

**가장 중요한 원칙**: 결과물은 "한국어를 아주 잘하는 사람이 쓴 글"이 아니라, **"베트남 학생이 자기 말로 쓴 글을 자연스럽게 한국어로 옮긴 글"** 이어야 합니다.
글이 지나치게 매끄러우면 심사하는 교수는 대필을 의심하고, 그러면 서류 전체의 신뢰가 무너집니다.
일부러 어색한 번역투로 쓰라는 뜻은 아닙니다. 맞춤법과 문법은 정확하되, **문장 구조와 어휘는 학생 수준에 머물러야** 합니다.

**쓰기 규칙**
1. **문장**: 짧고 단순하게. 한 문장에 한 가지 사실만. 문장을 접속어로 길게 잇지 마세요. 한 문단은 3~5문장.
2. **어휘**: 일상적인 말. 신문 사설이나 자기계발서에서 쓰는 한자어·추상 개념어·전문 용어를 쓰지 마세요. 쉬운 말로 바꿀 수 있으면 쉬운 말로.
3. **금지**: 비유·은유·속담·관용구, 미사여구, 감정 과장, 대구·반복 같은 수사, "한 걸음 더 나아가", "밑거름이 되겠습니다", "제2의 고향" 같은 상투어, 질문형·감탄형 마무리.
4. **접속**: '그리고·그래서·하지만' 정도만. '또한, 뿐만 아니라, 나아가, 이를 통해, ~하며'로 문장을 이어 붙이지 마세요.
5. **어미**: '-습니다' 체. 문장 끝이 단조롭게 반복돼도 괜찮습니다 — 오히려 학생이 쓴 글처럼 보입니다.
6. **내용**: 학생이 준 사실만 씁니다. 없는 경험·수치·이름·포부를 만들지 마세요.
   학생이 적지 않은 감상·취향·습관을 덧붙이는 것도 창작입니다(예: 자료에 없는데 "가족과 함께 시간을 보내는 것이 좋습니다", "예쁜 풍경을 보면 사진을 찍습니다" 를 넣지 마세요).
   자료의 한 줄은 한두 문장으로만 풀고, 말을 보태 늘리지 마세요.
   **특히 숫자와 기간을 만들지 마세요** — 나이 차이, 몇 년째, 몇 번, 학교 이름, 지역, 시기는 자료에 적힌 것만 씁니다.
   느낌·평가를 덧붙이지 마세요("처음에는 어려웠지만 실력이 늘었습니다", "친구들이 저를 믿어줍니다" 같은 문장).
   글이 짧아지는 것은 괜찮습니다. **자료에 없는 문장은 한 줄도 쓰지 마세요.** 자료가 적으면 짧게 끝냅니다. 분량을 채우려고 "한국은 발전된 나라입니다" 같은 일반론으로 늘리지 마세요.
7. **나이**: 지원자 나이에 맞는 경험과 포부만. 18~20세면 학교·가족·취미·진로 희망 정도입니다. 업계 분석이나 거창한 인생관은 쓰지 마세요.
8. **한국어 실력(TOPIK)**: 아래 기준을 지킵니다.
   - 없음 또는 1~2급: 아주 단순한 문장. 한 문장 25자 안팎. 기본 어휘만. 문단 2~3개.
   - 3~4급: 단순하고 명확한 문장. 한 문장 35자 안팎. 흔히 쓰는 한자어까지만.
   - 5~6급: 문장을 조금 더 이어도 되지만 여전히 담백하게. 화려한 표현은 여전히 금지.
9. **글자수**: 제한이 있으면 그 안에서. 없으면 질문의 무게에 맞게(대개 400~800자).
10. **출력**: 답변 본문만. 마크다운·제목·머리말·"답변:" 같은 말 금지.

**같은 자료로 쓴 좋은 예 / 나쁜 예**
자료: 취미는 사진, 고2부터 일러스트 / 성격 차분, 약속 지킴 / 호치민 출생, 중학생 때 다낭 이사 / 부모님 회사원, 여동생 1명

좋은 예 (이 정도가 목표입니다):
"저는 베트남 호치민에서 태어났습니다. 중학생 때 가족과 함께 다낭으로 이사했습니다. 부모님은 회사에 다니시고, 여동생이 한 명 있습니다. 저는 차분한 성격입니다. 친구와 한 약속은 꼭 지키려고 합니다. 제 취미는 사진을 찍는 것입니다. 고등학교 2학년 때부터는 일러스트도 그리기 시작했습니다."

나쁜 예 (이렇게 쓰지 마세요):
"저는 베트남 호치민에서 태어나 중학생 시절 가족과 함께 다낭으로 이주하여 그곳에서 성장하였습니다. 평소 차분한 성격으로 작은 약속이라도 소중히 여기며, 고등학교 시절부터 사진을 통해 일상의 순간을 기록해 왔고 2학년 때부터는 일러스트 작업을 병행하며 시각적 표현에 대한 관심을 꾸준히 발전시켜 왔습니다."
→ 문장이 길고 표현이 세련돼서, 외국인 학생이 직접 쓴 글로 보이지 않습니다.`;

/** 나이·TOPIK 등급에 따른 추가 지침 (사용자 메시지에 붙인다) */
function levelGuide(age?: number, topik?: string | number | null): string {
  const lines: string[] = [];
  if (age && age > 0) {
    lines.push(
      `- 지원자 나이: 만 ${age}세` +
        (age <= 20
          ? " — 고등학교를 갓 졸업한 나이입니다. 학교·가족·취미·진로 희망 수준으로만 쓰고, 사회 경험이나 업계 이야기는 쓰지 마세요."
          : age <= 24
            ? " — 사회 경험이 길지 않습니다. 학생이 적은 경험만 쓰세요."
            : " — 학생이 적은 경력·경험 범위 안에서만 쓰세요.")
    );
  }
  const lv = Number(String(topik ?? "").replace(/[^0-9]/g, ""));
  if (!lv) {
    lines.push("- 한국어 실력: TOPIK 없음 또는 확인 안 됨 — **아주 단순한 문장**으로 쓰세요. 한 문장 25자 안팎, 기본 어휘만, 문단 2~3개.");
  } else if (lv <= 2) {
    lines.push(`- 한국어 실력: TOPIK ${lv}급 — **아주 단순한 문장**으로 쓰세요. 한 문장 25자 안팎, 기본 어휘만, 문단 2~3개.`);
  } else if (lv <= 4) {
    lines.push(`- 한국어 실력: TOPIK ${lv}급 — 단순하고 명확한 문장. 한 문장 35자 안팎, 흔한 한자어까지만.`);
  } else {
    lines.push(`- 한국어 실력: TOPIK ${lv}급 — 문장을 조금 더 이어도 되지만 담백하게. 화려한 표현은 쓰지 마세요.`);
  }
  return lines.join("\n");
}

export type EssayDraftInput = {
  questionKo: string;
  questionVi?: string;
  maxChars?: number;
  /** [{label_ko, value}] — 학생의 기초 데이터 */
  basisFacts: Array<{ label_ko: string; value: string }>;
  /** 학생 이름·기본 정보 (있으면 자연스러운 톤 만들 때 활용) */
  studentName?: string;
  /** 만 나이 — 나이에 안 맞는 경험·포부를 쓰지 않게 */
  studentAge?: number;
  /** TOPIK 등급 (1~6, 없으면 생략) — 문장 길이·어휘 수준을 여기에 맞춘다 */
  topikLevel?: string | number | null;
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
    (input.studentName ? `이름: ${input.studentName}\n` : "") +
    levelGuide(input.studentAge, input.topikLevel) +
    `\n\n` +
    `# 기초 데이터 (학생이 유학센터에 제공한 정보)\n` +
    factLines +
    `\n\n# 양식 질문 (한국어)\n` +
    input.questionKo +
    (input.questionVi ? `\n\n베트남어 번역 (참고): ${input.questionVi}` : "") +
    (input.maxChars
      ? `\n\n글자수 제한: ${input.maxChars}자 이내`
      : "") +
    `\n\n위 질문에 대한 답변을 작성해주세요. 위의 나이·한국어 실력 기준을 지키세요. 한국어를 잘하는 사람이 쓴 것처럼 매끄럽게 쓰지 말고, 학생이 직접 쓴 것처럼 담백하게. 답변 텍스트만 출력. 다른 설명 없이.`;

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
