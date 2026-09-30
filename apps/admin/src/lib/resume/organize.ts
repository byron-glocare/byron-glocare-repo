/**
 * 이력서 AI 정리 — 학생이 제출한 원본(raw)을 가이드 규칙대로 정돈된
 * 구조(ResumeContent)로 변환한다.
 *   - 경력/학력/자격/기타활동/기술/기본정보: 날짜·표기·중복·구어체를 깔끔히 정리
 *   - 자기소개(intro): 학생 원문을 "외국인이 직접 쓴 듯한" 어색한 한국어 톤으로 유지
 *   - 사실만: 원본에 없는 경험·날짜·숫자·기관명 창작 금지, 모르면 빈 값
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  resumeContentSchema,
  type ResumeContent,
  type ResumeDraftData,
} from "@/lib/validators";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `당신은 한국에서 요양보호사로 취업하려는 외국인(주로 베트남) 학생의 이력서를 정리합니다.
학생이 제출한 원본 데이터(JSON)를 받아, 아래 규칙대로 **정돈된 이력서 JSON** 을 출력합니다.

## 절대 규칙
- **사실만**: 원본에 없는 경험·이름·숫자·날짜·기관명을 절대 만들지 않는다. 모르면 빈 문자열 "".
- 오타·띄어쓰기·구어체는 바로잡되 내용은 바꾸지 않는다.
- 읽는 사람은 어르신·보호자·채용 담당자. 쉽고 짧게.

## 필드별 규칙
- name_en: 여권식 영문 대문자(원본 name_vi 기반). name_ko: 한글 발음(name_kr).
- headline: 한 줄 소개. 40자 이내, 다짐형 존댓말("~하겠습니다."), 따옴표 없이. 원본 one_liner 다듬기.
- info: [{k,v}] 배열. **생년(예 "1998년"), 주소(동 단위까지)만 기본 포함**. 연락처·이메일은 넣지 않는다. 국적/비자는 원본에 있으면만.
- skills: [{name, level}]. level 은 4자 이내(원어민/상급/중급/초급 등). 상세가 수준과 같으면 하나만.
- educations/careers/activities: [{period, status, title, sub, duties[]}]
  - period: 기간. "YYYY.MM – YYYY.MM"(범위 앞뒤 공백+en dash) 또는 "YYYY – YYYY". 월 정보 없으면 연도만.
  - status: 졸업/재학/수료/재직/퇴사 등 원본 그대로 정리.
  - title: 학교명/근무처/활동명. sub: 전공/직책/세부.
  - duties: 주요 업무 2~4개, 각 항목 **명사형**(마침표·"~함"·"~했습니다" 금지). 예 "환자 이동 및 일상생활 보조". 학력엔 보통 빈 배열.
- certifications: [{title, sub, date}]. title 공식 명칭(급수 붙임), sub 발급기관, date "YYYY.MM.DD". 최신순 정렬.
- intro: 자기소개 문단 배열(string[]). 3~5문단. **학생 원문(narrative_raw)을 기반으로**, 한국어 초중급 수준의 담백한 문장으로. 일부러 매끄럽게 윤문하지 말 것(AI 티 나면 안 됨). 없는 사실 창작 금지. 원문이 비면 빈 배열.

## 출력
- **오직 JSON 하나만** 출력. 코드블록·설명·머리말 금지.
- 스키마: {"name_en":"","name_ko":"","headline":"","info":[{"k":"","v":""}],"skills":[{"name":"","level":""}],"educations":[{"period":"","status":"","title":"","sub":"","duties":[]}],"careers":[...],"certifications":[{"title":"","sub":"","date":""}],"activities":[...],"intro":[""]}`;

export type OrganizeResult =
  | { ok: true; content: ResumeContent }
  | { ok: false; error: string };

export async function organizeResume(
  raw: ResumeDraftData
): Promise<OrganizeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY 환경변수 미설정" };

  const client = new Anthropic({ apiKey });

  const userMessage = `학생이 제출한 이력서 원본 데이터입니다. 규칙대로 정돈된 이력서 JSON 으로 변환해 주세요.

\`\`\`json
${JSON.stringify(raw, null, 2)}
\`\`\`

JSON 만 출력하세요.`;

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "AI 응답에 텍스트가 없습니다" };
    }
    // 코드블록 감싸짐 방어
    const jsonText = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { ok: false, error: "AI 응답 JSON 파싱 실패" };
    }
    const result = resumeContentSchema.safeParse(parsed);
    if (!result.success) {
      return { ok: false, error: `AI 결과 형식 오류: ${result.error.issues[0]?.message ?? ""}` };
    }
    return { ok: true, content: result.data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return { ok: false, error: `Claude API 호출 실패: ${msg}` };
  }
}

/**
 * AI 없이 원본을 그대로 매핑한 기본 이력서(폴백/미생성 상태 표시용).
 * 정리 없이 최소 변환만 한다.
 */
export function rawToContent(raw: ResumeDraftData): ResumeContent {
  const info: { k: string; v: string }[] = [];
  if (raw.birth_date) info.push({ k: "생년", v: raw.birth_date });
  if (raw.address) info.push({ k: "주소", v: raw.address });
  return {
    name_en: raw.name_vi.toUpperCase(),
    name_ko: raw.name_kr,
    headline: raw.one_liner,
    info,
    skills: raw.skills.map((s) => ({
      name: s.name,
      level: s.detail && s.detail !== s.level ? `${s.level} ${s.detail}`.trim() : s.level,
    })),
    educations: raw.educations.map((e) => ({
      period: [e.start_year, e.end_year].filter(Boolean).join(" – "),
      status: e.status,
      title: e.school,
      sub: e.major,
      duties: [],
    })),
    careers: raw.careers.map((c) => ({
      period: c.period,
      status: c.status,
      title: c.workplace,
      sub: c.role,
      duties: c.detail ? c.detail.split(/\r?\n/).map((d) => d.trim()).filter(Boolean) : [],
    })),
    certifications: raw.certifications.map((c) => ({
      title: c.name,
      sub: c.detail,
      date: c.date,
    })),
    activities: raw.activities.map((a) => ({
      period: a.period,
      status: "",
      title: a.name,
      sub: a.detail,
      duties: [],
    })),
    intro: (raw.narrative_polished || raw.narrative_raw)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean),
  };
}
