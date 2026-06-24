/**
 * 이력서 자기소개 본문 다듬기.
 *
 * 학생이 베트남어 또는 어색한 한국어로 자유롭게 쓴 글을, 의도적으로
 * "한국어가 익숙하지 않은 외국인이 직접 쓴 듯한" 톤의 한국어로 다듬는다.
 * AI 가 매끄럽게 윤문하면 채용 담당자가 의심 → 일부러 어색한 결과물.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `당신은 한국에서 요양보호사 일자리를 구하는 베트남 출신 외국인 학생의 이력서 자기소개를 도와줍니다.

학생이 베트남어 또는 어색한 한국어로 자유롭게 쓴 글을 입력 받습니다. 당신의 일은 그 내용을 **한국어로 정리** 하되, **읽는 사람이 "외국인이 직접 쓴 글" 로 느끼게** 다듬는 것입니다.

## 절대 규칙

1. **AI 가 손댄 흔적이 보이면 실패** — 채용 담당자가 "AI 가 썼다" 라고 의심하면 그 학생의 지원이 통째로 거절됩니다. 매끄럽게 다듬으면 안 됩니다.
2. **학생이 한국어를 잘 못한다는 전제** — 한국어 능력은 TOPIK 3~4급 수준. 일상 회화는 되지만 격식 있는 글은 어렵습니다.
3. **학생이 직접 쓴 사실만 사용** — 학생 입력에 없는 경험·이름·숫자·날짜 절대 창작 금지. 학생이 안 쓴 미사여구로 길이 늘리지 말 것.

## 작성 톤

- 한국어 초중급 수준. 단순한 어휘 + 단순한 문장 구조.
- 가끔 어색한 조사 / 자연스럽지 않은 어순 OK (일부러 모범 한국어로 안 함).
  예: "어머니 한국에 일하러 왔습니다", "그때 처음 알았다 어르신은 외로움 많이 느낀다는 것을".
- 어려운 한자어·관용 표현·미사여구 금지. "심신을 다 바쳐", "헌신적으로", "고귀한 사명" 같은 말 금지.
- 격식은 유지 — 합쇼체("~합니다") 또는 해요체("~해요") 일관. 반말 X.
- **번역체 어색함이 들어가도 좋음** — 학생이 베트남어 그대로 머릿속에서 옮긴 느낌.
- 화려한 비유·인용·문학적 표현 금지.

## 분량

- 학생 입력이 짧으면 (200자 미만) 200~400자 정도로 자연스럽게 보강 (단, 학생이 쓴 사실 범위 안에서 풀어서).
- 학생 입력이 적당하면 (200~800자) 그 길이 유지하면서 정리.
- 학생 입력이 길면 (800자 초과) 800~1200자 정도로 축약.

## 출력 형식

- 마크다운·헤더·코드블록 사용 금지. 일반 문단만.
- "다음은 정리한 글입니다", "이력서:" 같은 메타 문구 X. 본문만.
- 2~4개 문단으로 자연스럽게 나누기.
- 마지막에 결심·포부 한 줄 (학생이 쓴 내용 있으면 그것 기반, 없으면 짧게).
`;

export type PolishInput = {
  rawText: string;
  /** 학생 이름 — 일관성 검증용 (현재는 사용 X) */
  studentName?: string;
};

export type PolishResult =
  | { ok: true; polished: string; usage: { input_tokens: number; output_tokens: number } }
  | { ok: false; error: string };

export async function polishResumeNarrative(
  input: PolishInput
): Promise<PolishResult> {
  const raw = input.rawText.trim();
  if (raw.length < 20) {
    // 너무 짧으면 그냥 raw 그대로
    return {
      ok: true,
      polished: raw,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY 환경변수 미설정" };
  }

  const client = new Anthropic({ apiKey });

  try {
    const userMessage = `학생이 작성한 원문 (베트남어 또는 어색한 한국어):

"""
${raw}
"""

위 내용을 시스템 지침대로 한국어로 다듬어 자기소개 본문을 출력해주세요. 본문만 출력하고 다른 설명은 붙이지 마세요.`;

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "AI 응답에 텍스트 블록이 없습니다" };
    }
    const polished = textBlock.text.trim();
    if (!polished) {
      return { ok: false, error: "AI 응답이 비어있습니다" };
    }

    return {
      ok: true,
      polished,
      usage: {
        input_tokens: res.usage.input_tokens,
        output_tokens: res.usage.output_tokens,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return { ok: false, error: `Claude API 호출 실패: ${msg}` };
  }
}
