/**
 * 학생 정보 값 번역 — 베트남어 입력 → 한국어(+고유명사는 영어).
 *
 * 규칙(운영자 요구):
 *   - 학교·기관·지명·인명 등 고유명사 → 영어(로마자) 유지.
 *   - 아버지/어머니, 농부/사업가 같은 일반 명사(관계·직업 등) → 한국어.
 * 문맥(항목명)을 함께 넘겨 Claude 가 항목 성격에 맞게 판단한다.
 *
 * 반환은 "최종 사용값"(문서에 그대로 들어갈 값). API 키 없거나 베트남어가
 * 아니면 원문 그대로 반환(서비스 degrade).
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

/** 베트남어 diacritic(U+1E00–U+1EFF) 또는 đ/Đ 포함 여부. */
export function isVietnamese(text: string): boolean {
  return /[Ḁ-ỿĐđ]/.test(text);
}

/** 한글이 10% 이상이면 이미 한국어로 간주(번역 불필요). */
export function isMostlyKorean(text: string): boolean {
  const total = text.length;
  if (total === 0) return false;
  const hangul = (text.match(/[가-힯]/g) ?? []).length;
  return hangul / total >= 0.1;
}

const SYSTEM_PROMPT = `당신은 한국 대학 유학 서류에 쓸 학생 정보를 **한국어로** 번역하는 전문가입니다.
입력값의 원래 언어(베트남어·영어 등)가 무엇이든 **결과는 한국어**여야 합니다.

# 규칙
1. **일반 명사·서술(가족관계·직업·상태 등)은 자연스러운 한국어로.**
   - 관계: "bố"/"father"→"아버지", "mẹ"/"mother"→"어머니", "anh trai"→"형/오빠".
   - 직업: "nông dân"/"farmer"→"농부", "kinh doanh"→"사업가", "giáo viên"/"teacher"→"교사",
     "công nhân"→"노동자", "nội trợ"→"주부".
2. **고유명사(사람 이름·학교·기관·지명)는 한국어 표기(음차)로.**
   - 사람 이름: "Nguyễn Văn A" → "응우옌 반 아"  (※ 영어 로마자로 두지 말 것)
   - 지명: "Hà Nội" → "하노이", "Hồ Chí Minh" → "호치민"
   - 학교·기관: "Trường THPT Chuyên Hà Nội" → "하노이 영재고등학교"
3. **주소**도 한국어로: "Số 12, phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
   → "호치민시 1군 벤응에동 12번지".
4. 숫자·날짜·코드·이메일·전화번호·여권번호는 **그대로** 둔다.
5. 이미 한국어면 그대로 둔다.

# 출력
번역 결과 **문자열만** 한 줄로 출력. 따옴표·설명·코드블록·접두사 금지.`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export type TranslateValueResult =
  | { ok: true; text: string; translated: boolean }
  | { ok: false; error: string };

/**
 * 단일 값 번역. label(항목명)을 문맥으로 함께 전달.
 *   - 이미 한국어거나 베트남어가 아니면 번역하지 않고 원문 반환(translated=false).
 */
export async function translateStudentValue(input: {
  label: string;
  text: string;
}): Promise<TranslateValueResult> {
  const text = (input.text ?? "").trim();
  if (!text) return { ok: true, text: "", translated: false };

  // 이미 한국어 위주면 번역 불필요 (불필요한 호출 절약)
  if (isMostlyKorean(text)) return { ok: true, text, translated: false };

  // ※ 예전엔 베트남어(성조기호) 가 없으면 건너뛰었는데, 그 탓에 "father" 같은
  //   영어 입력이 번역되지 않고 그대로 남았다. 이제 [KR 번역] 은 사용자가 직접
  //   누르는 명시적 동작이므로 **원어 감지로 건너뛰지 않는다.**

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
              text: `항목명(field): ${input.label || "(미상)"}\n입력값: ${text}\n\n위 입력값을 규칙대로 번역해 결과 문자열만 출력.`,
            },
          ],
        },
      ],
    });
  } catch (e) {
    return {
      ok: false,
      error: `번역 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return { ok: false, error: "번역 응답에 텍스트가 없습니다." };
  }
  const out = block.text.trim().replace(/^["'`]|["'`]$/g, "").trim();
  if (!out) return { ok: true, text, translated: false };
  return { ok: true, text: out, translated: true };
}
