import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { createClient } from "@/lib/supabase/server";
import {
  extractTagsRequestSchema,
  extractedTagsSchema,
  type ExtractedTags,
} from "@/lib/consultation-tags";

/**
 * POST /api/extract-tags
 *
 * Body: { content: string, consultation_type: "training_center" | "care_home" }
 * Response 200: { stages: Stage[], tags: string[] }
 * Response 4xx/5xx: { error: string }
 *
 * Claude Haiku 4.5 + prompt caching. 태그 taxonomy 는 system prompt 에
 * cache_control 로 고정 → 동일 system 을 쓰는 후속 호출은 약 90% 저렴하게
 * 캐시 읽힘. Haiku 4.5 의 최소 캐시 prefix 는 4096 tokens 이므로 taxonomy
 * 정의를 충분히 상세하게 작성해야 실제로 캐시 발생.
 */

const SYSTEM_PROMPT = `당신은 베트남 요양보호사 교육생을 관리하는 한국 회사의 상담 일지 분석 전문가입니다. 상담 일지 한 건을 읽고, 해당 상담이 고객의 어떤 진행 단계에 해당하는지와 핵심 키워드 태그를 추출합니다. 결과는 JSON 한 개로만 응답합니다.

# 비즈니스 맥락

이 회사는 베트남인을 한국의 요양보호사 교육원에 등록시키고, 자격증 취득 후 요양원에 취업을 연결해 E-7-2 비자 변경까지 지원합니다. 고객 한 명은 아래 진행 단계를 거칩니다.

1. **접수** — 첫 문의, 기초 정보 수집, 상품 상담, 접수 포기/유학 전환 결정
2. **교육 예약** — 교육원 발굴/매칭, 강의일정 확인 및 확정, 예약금 입금, 강의 접수 메시지 발송, 교육 예약 포기
3. **교육** — 교육 시작 전/중/완료, 출결, 시험, 자격증 취득, 교육 드랍(중도 이탈)
4. **취업** — 요양원 발굴/매칭, 이력서 발송, 면접 일정/합격, 웰컴팩(유료 취업 알선 상품) 예약금/잔금, 웰컴팩 예약 포기
5. **근무** — 근무 시작/조건/이슈, E-7-2 비자 변경(근무 개시 30일 이후)
6. **종료** — 요양보호사 직종 변경, 귀국, 연락두절 등 최종 이탈

상담은 두 창구로 나뉩니다:
- training_center: 교육원과의 상담 (교육원 발굴·매칭·강의 관련이 주)
- care_home: 요양원과의 상담 (취업·면접·근무 관련이 주)

# 태그 추출 가이드

## stages (필수, 하나 이상)
상담 내용이 어떤 단계를 다루는지. 한 상담이 여러 단계를 동시에 언급하면 복수 허용.
값은 정확히 다음 6개 중: "접수", "교육 예약", "교육", "취업", "근무", "종료"

stage 매핑 예시:
- "이번 주 강의 일정 확인 부탁드립니다" → 교육 예약
- "학생이 시험에 합격했습니다" → 교육
- "면접 다음 주 화요일로 잡혔습니다" → 취업
- "학생이 근무 중 다쳐서 2주 쉬겠다고 연락" → 근무
- "연락 안 돼서 종료 처리할까요" → 종료
- "아직 교육원 못 찾고 있습니다 / 교육원 매칭 요청" → 교육 예약

## tags (선택, 최대 12개, 각 태그 40자 이내)
구체 상황을 짧은 명사구로. 세 종류를 자유롭게 섞음:

### A. 액션/체크포인트 태그
상담 내용에서 필요한 액션을 나타내는 키워드. 예:
- 교육원 발굴 필요, 교육원 매칭 요청, 강의 일정 확인, 강의일정 확정 필요
- 예약금 입금 대기, 예약금 입금 완료, 강의 접수 메시지 발송
- 자격증 취득, 교육 드랍, 시험 재응시
- 요양원 발굴 필요, 요양원 매칭 요청, 이력서 발송, 면접 일정 조율, 면접 합격, 면접 탈락
- 웰컴팩 상담, 웰컴팩 예약금, 웰컴팩 잔금
- 비자 변경 준비, 비자 변경 완료
- 접수 포기, 유학 전환, 교육 예약 포기, 웰컴팩 예약 포기, 직종 변경, 귀국, 연락두절

### B. 개인 프로필/상황 태그
고객의 배경을 간략히. 예:
- 한국어 상급 / 한국어 중급 / 한국어 초급, TOPIK 3급, KIIP 이수
- 서울 희망 / 부산 희망 / 수도권 희망, 지방 거주 가능
- 자녀 있음, 자녀 2명, 남편 동반, 가족 동반
- 비자 D-10, 비자 F-2-R, 비자 만료 임박
- 의지 강함, 의지 약함, 재상담 필요
- 경제 여유 있음, 경제적 어려움

### C. 이슈/리스크 태그
주의해야 할 포인트. 예:
- 건강 이슈, 체력 문제, 교통 문제, 근무지 이동 불가, 가족 반대
- 교육비 부담, 웰컴팩 부담
- 소통 어려움, 약속 불이행, 지각/결석 잦음

## 출력 규칙
- stages 는 반드시 1개 이상. 애매하면 대표 단계 하나만.
- tags 는 명확히 근거가 있는 것만. 추측은 하지 않음. 해당 없으면 빈 배열.
- 각 태그는 한국어 짧은 명사구 (40자 이내, 동사형 지양).
- 베트남어 상담이 들어오면 내용을 이해하고 태그는 한국어로만 출력.
- 동일 의미의 태그는 하나로 (예: "교육원 발굴 요청" 과 "교육원 발굴 필요" 동시 출력 금지).

# 출력 형식

반드시 다음 JSON 스키마만 반환. 텍스트 설명, 백틱, 코드블록 없이 JSON 본체만:

{
  "stages": ["교육 예약"],
  "tags": ["교육원 발굴 필요", "한국어 중급", "부산 희망"]
}

# 예시

## 예시 1 (교육원 상담, 베트남어 입력)
입력 content: "Em muốn học tại Busan, nhưng em chưa tìm được trung tâm nào. Em có TOPIK 3."
입력 consultation_type: "training_center"
출력:
{
  "stages": ["교육 예약"],
  "tags": ["교육원 발굴 필요", "부산 희망", "TOPIK 3급"]
}

## 예시 2 (요양원 상담, 한국어 입력)
입력 content: "학생 자격증 취득했고 이력서 준비 중입니다. 경기 지역 요양원 매칭 부탁드립니다. 면접은 다음 주부터 가능."
입력 consultation_type: "care_home"
출력:
{
  "stages": ["교육", "취업"],
  "tags": ["자격증 취득", "이력서 발송", "요양원 매칭 요청", "수도권 희망", "면접 일정 조율"]
}

## 예시 3 (요양원 상담, 종료 시그널)
입력 content: "학생이 한국 생활이 너무 힘들다며 귀국하겠다고 합니다. 가족이 반대도 심했다고 하네요."
입력 consultation_type: "care_home"
출력:
{
  "stages": ["종료"],
  "tags": ["귀국", "가족 반대"]
}

## 예시 4 (상담 정보 부족)
입력 content: "문의 주셔서 감사합니다."
입력 consultation_type: "training_center"
출력:
{
  "stages": ["접수"],
  "tags": []
}

위 가이드를 엄격히 따라 JSON 한 개만 응답하세요.`;

export async function POST(request: Request) {
  // 1. 인증 — 로그인한 관리자만 호출 가능
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. env 체크
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  // 3. 입력 검증
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식 오류" }, { status: 400 });
  }
  const parsed = extractTagsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 입력" },
      { status: 400 }
    );
  }
  const { content, consultation_type } = parsed.data;

  // 4. Claude 호출
  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      // 태그 taxonomy 는 고정 프롬프트 → cache_control 로 prefix 캐싱
      // (Haiku 4.5 는 최소 4096 tokens 여야 실제 캐시 히트, 그 이하는 silent miss)
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `consultation_type: ${consultation_type}\n---\ncontent:\n${content}`,
            },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(extractedTagsSchema),
      },
    });

    const parsedOutput: ExtractedTags | null = message.parsed_output;
    if (!parsedOutput) {
      return NextResponse.json(
        { error: "태그 추출 결과를 파싱할 수 없습니다." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ...parsedOutput,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_creation_input_tokens:
          message.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류 ${error.status}: ${error.message}` },
        { status: 502 }
      );
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
