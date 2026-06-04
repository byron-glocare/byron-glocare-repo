/**
 * Anthropic Claude SDK 헬퍼 — 이력서 raw 입력 → 구조화된 데이터로 변환.
 */
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function client(): Anthropic | null {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("[anthropic] ANTHROPIC_API_KEY 환경변수 없음");
    return null;
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export type StructuredResume = {
  ai_education: Array<{
    school: string;
    major?: string;
    period?: string;
    status?: string;
  }>;
  ai_experience: Array<{
    place: string;
    period?: string;
    role?: string;
    detail?: string;
    status?: string;
  }>;
  ai_certificates: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
  ai_skills: Array<{
    name: string;
    detail?: string;
    level?: string;
  }>;
  ai_activities: Array<{
    name: string;
    period?: string;
    org?: string;
    detail?: string;
  }>;
  ai_self_intro: string;
};

const SYSTEM_PROMPT = `너는 외국인 (베트남) 요양보호사 이력서 작성을 돕는 AI 야.
사용자가 자유롭게 입력한 raw 텍스트를 받아서 정형화된 JSON 구조로 변환한다.

원칙:
- 한국어로 출력 (학교명·기관명·자격증 명칭 등은 한자/한국어 그대로)
- 키 이름은 영문 (school, major, period 등)
- 빈 값은 빈 문자열 "" 또는 생략 가능
- 자기소개·포부 (ai_self_intro) 는 사용자가 적은 에피소드와 포부를 자연스럽고 따뜻하게 다듬어 한국어로 1-2 단락. 너무 길지 않게.
- AI 임을 절대 드러내지 말 것 (예: "이 이력서는 AI가 작성..." 같은 말 금지)
- 사용자의 진솔한 어투 유지`;

const USER_TEMPLATE = (raw: {
  motto?: string;
  education?: string;
  experience?: string;
  certificates?: string;
  skills?: string;
  activities?: string;
  episode?: string;
}) => `다음은 사용자가 자유롭게 입력한 정보야. JSON 으로 구조화해줘.

=== 한 줄 포부 ===
${raw.motto ?? "(없음)"}

=== 학력 ===
${raw.education ?? "(없음)"}

=== 경력 ===
${raw.experience ?? "(없음)"}

=== 자격증 / 수상 ===
${raw.certificates ?? "(없음)"}

=== 기술 / 어학 ===
${raw.skills ?? "(없음)"}

=== 기타 활동 ===
${raw.activities ?? "(없음)"}

=== 교육·실습 에피소드 ===
${raw.episode ?? "(없음)"}

위 내용을 다음 JSON 으로 정리해서 반환:
{
  "ai_education": [{"school": "...", "major": "...", "period": "...", "status": "졸업/재학/예정 등"}],
  "ai_experience": [{"place": "...", "period": "...", "role": "...", "detail": "...", "status": "퇴직/재직"}],
  "ai_certificates": [{"name": "...", "issuer": "...", "date": "..."}],
  "ai_skills": [{"name": "...", "detail": "...", "level": "초급/중급/고급/모국어 등"}],
  "ai_activities": [{"name": "...", "period": "...", "org": "...", "detail": "..."}],
  "ai_self_intro": "사용자가 적은 에피소드를 자연스럽게 다듬은 자기소개·포부 한·두 단락"
}

JSON 만 반환 (마크다운 \`\`\`json 등 감싸지 말 것).`;

export async function structureResume(raw: {
  motto?: string;
  education?: string;
  experience?: string;
  certificates?: string;
  skills?: string;
  activities?: string;
  episode?: string;
}): Promise<{ ok: true; data: StructuredResume } | { ok: false; error: string }> {
  const c = client();
  if (!c) {
    return { ok: false, error: "Anthropic API 키 미설정" };
  }

  try {
    const msg = await c.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: USER_TEMPLATE(raw) }],
    });

    const text =
      msg.content[0]?.type === "text" ? msg.content[0].text : "";

    if (!text) return { ok: false, error: "AI 응답이 비어 있습니다." };

    // JSON 추출 (마크다운 등 제거)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ok: false, error: "JSON 파싱 실패: " + text.slice(0, 200) };
    }
    const parsed = JSON.parse(jsonMatch[0]) as StructuredResume;
    return { ok: true, data: parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[anthropic] structureResume error:", msg);
    return { ok: false, error: msg };
  }
}
