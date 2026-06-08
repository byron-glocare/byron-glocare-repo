/**
 * 모집요강 PDF → spec_data JSONB 자동 추출.
 *
 * 사용 모델: Claude Sonnet (vision + PDF document input).
 * 결과 검증: spec-schema.ts (PoC step3 lock).
 *
 * 프롬프트 캐싱: 시스템 프롬프트 + JSON Schema 는 ephemeral cache 적용.
 *               PDF document 자체는 매번 다르므로 캐싱 X.
 *
 * 베트남 순수외국인 필터: 시스템 프롬프트에 명시.
 *   다른 국적·카테고리 정보(중국·우즈벡·재외동포·결혼이주민 등)는
 *   추출 시점에 자동 생략.
 *
 * 참고:
 *   - PoC 결과: reports/admission_poc/step2_field_inventory.md
 *   - 스키마: src/lib/admission/spec-schema.ts
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  admissionSpecSchema,
  type AdmissionSpec,
} from "./spec-schema";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8192;

/**
 * 시스템 프롬프트 — ephemeral 캐시 대상.
 * 변경 시 캐시 무효화 → 변경 자주 안 함.
 */
const SYSTEM_PROMPT = `당신은 한국 대학의 외국인 입학 모집요강을 분석해 구조화된 JSON 으로 변환하는 전문가입니다.

# 핵심 규칙

1. **베트남 순수외국인 필터** — 출력에는 베트남 국적 학생에게 적용 가능한 정보만 포함하세요.
   - 제외: 우즈베키스탄 전용 / 중국 호구부·CHSI 학력인증 / 재외동포(F-4) 우대 / 결혼이주민 / 북한이탈주민 / F-1·F-3·E-7 비자 우회 등
   - 보존: TOPIK / 세종학당 / KIIP / 대학 자체 한국어시험 / 보건계열 학위·요양 경력 (베트남에서 취득 가능)
   - 베트남 학력 인증: 아포스티유 미가입국 처리 → 주베트남 한국대사관 영사확인 또는 주한 베트남공관 확인 (모집요강에 명시된 경우 그대로)

2. **출력 형식** — 반드시 admissionSpecSchema (다음 JSON 형식) 에 맞는 단일 JSON. 다른 텍스트(설명·마크다운·주석) 절대 출력하지 말 것.

3. **모르는 값** — null 또는 빈 배열로. 추측·창작 금지. 확신할 수 없으면 비워둘 것.

4. **데이터 정규화**:
   - 날짜: ISO 8601 (YYYY-MM-DD)
   - 금액: 정수 (원화 KRW, 단위 표기 제거)
   - TOPIK 등급: 정수 (1~6)
   - 다단계 모집(1차/2차/수시1차 등): schedule.rounds[] 배열

5. **multi-department** — 모집요강이 여러 학과를 포함하면 departments[] 배열에 각각.
   학과별로 등록금·한국어 요건이 다르면 각 학과 객체 안에 분기.

# 스키마 (zod → JSON Schema)

\`\`\`json
{
  "identity": {
    "university_name_ko": "string",
    "program_type": "language_program | associate_2yr | bachelor_3yr_extension | bachelor_4yr (레거시 인덱스용. 대표 학과 기준 best-effort: 어학연수→language_program, 전문학사→associate_2yr, 학사→bachelor_4yr. 실제 과정/년제는 departments[] 의 degree/years 에 학과별로)",
    "term": "YYYY-(Spring|Fall|Summer|Winter|Year)",
    "admission_category": "string (선택·사실상 미사용 — 우리는 순수외국인 전형만 다룸. 비워도 됨)",
    "campus_location_ko": "string (선택)"
  },
  "departments": [
    {
      "faculty": "string (학부/계열)",
      "name": "string (학과명)",
      "track": "string (세부 트랙, 선택)",
      "program_kind": "language | degree (어학연수면 language, 학위과정이면 degree. 기본 degree)",
      "degree": "associate | bachelor | master | doctoral (학위과정일 때. 전문학사/학사/석사/박사)",
      "years": "1-6 (년제. 예: 전문학사 2~3, 학사 4)",
      "capacity": "number | 'unlimited' | string (모집인원. 순수외국인 전형은 대부분 무제한 → 'unlimited'. 공란·'-'·'제한없음'도 'unlimited'. 우리가 받은 정원(TO)이 명시되면 number)",
      "korean_min_topik": "1-6 (학과별 한국어 요건 분기 시)",
      "tuition_per_semester_krw": "number (학과별 등록금 분기 시)"
    }
  ],
  "required_documents": [
    {
      "key": "highschool_diploma | highschool_transcript | passport_copy | photo | family_relations_certificate | nationality_proof | bank_balance | financial_proof | korean_proof | application_form | self_intro | study_plan | financial_pledge_form | privacy_consent | academic_record_release | topik_certificate | language_alt_certificate | career_certificate | license_copy | visa_application_form | other",
      "name_ko": "string (원본 한국어 표기)",
      "required": "boolean",
      "target_person": "self | father | mother | other (이 서류가 누구 것인지. 본인 서류=self, 아버지/어머니 서류=father/mother, 보호자·재정보증인 등=other). 모집요강이 '본인/부모'처럼 구분하면 각각 분리해 적을 것",
      "target_person_note": "string (target_person='other' 일 때 누구인지, 예: '재정보증인')",
      "notarization": "none | translation_notarization | consul | consul_for_vietnam | apostille | apostille_or_consul (해당 시)",
      "language": "ko | en | vi | ko_or_en | any",
      "notes": "string (선택, 한국어)"
    }
  ],
  "eligibility": {
    "applicant_categories": ["베트남 순수외국인 카테고리만"],
    "education_required": "high_school | high_school_12yrs | health_related_bachelor | bachelor | master",
    "education_paths": ["string"],
    "education_exclusions": ["string (예: '검정고시·홈스쿨링·사이버학습 불인정')"],
    "korean_proficiency": {
      "topik_min_default": "1-6 | null",
      "topik_min_by_dept_category": { "예체능": 2, "일반": 3 },
      "alternative_paths": [
        { "type": "sejong_institute | kiip | university_internal_test | korean_education_center | health_science_degree | elder_care_career | other", ... }
      ],
      "post_admission_requirement": "string (졸업 전 의무, 예: 'TOPIK 4급 이상')"
    },
    "financial_minimum": {
      "amount": "number (KRW)",
      "currency": "KRW",
      "holder_relations": ["self | parent | other (예금주. 본인/부모, 그 외(보호자·재정보증인 등)는 other)"],
      "holder_other_note": "string (holder_relations 에 other 가 있을 때 누구인지, 예: '재정보증인')",
      "freshness_days": "30 (발급일 기준)"
    },
    "exclusions": ["복수국적자 등"]
  },
  "schedule": {
    "rounds": [
      {
        "name": "1차 | 수시1차 | 정시 등",
        "application_open": "YYYY-MM-DD",
        "application_close": "YYYY-MM-DD",
        "document_submission_close": "YYYY-MM-DD (선택)",
        "interview": "YYYY-MM-DD (선택)",
        "interview_period": ["YYYY-MM-DD", "YYYY-MM-DD"],
        "result_announcement": "YYYY-MM-DD",
        "payment_period": ["YYYY-MM-DD", "YYYY-MM-DD"]
      }
    ],
    "semester_start": "YYYY-MM-DD",
    "submission_method": "방문접수 또는 우편접수 등"
  },
  "tuition": {
    "currency": "KRW",
    "unit": "per_semester | per_year | per_program | pending",
    "disclosure_state": "disclosed | pending_until_acceptance",
    "application_fee": "number | null",
    "tuition_per_semester": "number | null",
    "tuition_by_faculty": { "보건": 3477600, "사회실무": 3182600 },
    "refund_policy": { ... }
  },
  "scholarships": [
    {
      "name": "장학금명",
      "applies_to": "freshman | enrolled | both",
      "condition": "조건",
      "benefit_type": "tuition_pct | tuition_amount | admission_fee_waiver | stipend | dorm | policy | other",
      "benefit_value": "number (% 면 0.5, 정액이면 500000)",
      "tiered_by_topik": { "3": 0.30, "4": 0.40, "5": 0.50, "6": 0.60 },
      "exclusivity_with": ["다른 장학금 name"]
    }
  ],
  "metadata": {
    "selection_process": {
      "method": "서류전형 100% 또는 한국어평가 50% + 면접 50%",
      "score_breakdown": { "korean_test": 100, "interview": 100 },
      "pass_threshold": "150",
      "interview_required": "boolean"
    },
    "post_acceptance": {
      "visa_type": "D-2 (default)",
      "post_graduation_visa": "E-7 (요양보호사 등)",
      "vn_specific_visa_documents": ["지급유보방식 잔고증명서 등"]
    },
    "contacts": {
      "phone": "string",
      "email": "string",
      "address_ko": "string",
      "website": "string"
    },
    "government_designations": [
      {
        "agency": "moj | mohw | moj_mohw_joint | moe",
        "designation_name": "외국인 요양보호사 양성대학 등",
        "benefits": ["relaxed_visa_financial", "relaxed_stay_extension", "e7_eligible_after_graduation", "min_wage_guaranteed"]
      }
    ]
  }
}
\`\`\`

위 스키마에 정확히 맞는 단일 JSON 만 출력하세요. 다른 텍스트 없이.`;

export type ExtractInput = {
  /**
   * 입력 형식:
   *   - PDF: vision 으로 분석 (리플릿·복잡한 레이아웃 대응)
   *   - HWP/HWPX → markdown: text 입력 (저렴·빠름. 표 마크다운으로 보존됨)
   */
  source:
    | { kind: "pdf"; pdfBuffer: Buffer }
    | { kind: "markdown"; markdown: string; sourceFormat: "hwp" | "hwpx" };
  /** 메타 정보 — 추출 후 identity 보정용 */
  universityNameKo: string;
  term: string;
  /** 운영자 제공 admission_category (없으면 모델이 결정) */
  admissionCategory?: string;
};

export type ExtractResult = {
  ok: true;
  spec: AdmissionSpec;
  raw: string;
  /** 사용된 토큰 (비용 추정) */
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  /** 신뢰도 (0~1) — 후속 라운드에 정교화 */
  confidence: number;
  /** zod 검증 경고 — 운영자가 검수 폼에서 fix 권장 */
  validationWarnings?: string[];
} | {
  ok: false;
  error: string;
  raw?: string;
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

/**
 * PDF buffer 또는 HWP markdown → spec JSON 추출.
 *   - PDF: Sonnet vision 의 PDF document input (리플릿·디자인 보존)
 *   - HWP markdown: text 입력 (저렴·빠름)
 *   - 시스템 프롬프트 캐싱 (5분 TTL)
 *   - spec-schema.ts zod 검증
 */
export async function extractAdmissionSpec(
  input: ExtractInput
): Promise<ExtractResult> {
  const metaText =
    `메타 정보 — 모델은 이 정보로 identity 필드 보정:\n` +
    `- university_name_ko: ${input.universityNameKo}\n` +
    `- term: ${input.term}\n` +
    (input.admissionCategory
      ? `- admission_category (운영자 제공): ${input.admissionCategory}\n`
      : "");

  // 입력 형식별 user content 빌드
  type UserContent = Anthropic.MessageCreateParams["messages"][number]["content"];
  let userContent: UserContent;
  if (input.source.kind === "pdf") {
    const pdfBase64 = input.source.pdfBuffer.toString("base64");
    userContent = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdfBase64,
        },
      },
      {
        type: "text",
        text:
          metaText +
          `\n위 모집요강 PDF 를 분석해 admissionSpecSchema 형식의 JSON 한 개만 출력하세요. 베트남 순수외국인 필터 적용 필수.`,
      },
    ];
  } else {
    // markdown (HWP/HWPX 변환 결과)
    userContent = [
      {
        type: "text",
        text:
          metaText +
          `\n아래는 ${input.source.sourceFormat.toUpperCase()} 모집요강을 Markdown 으로 변환한 텍스트입니다 (표는 마크다운 표로 보존).\n\n` +
          `---DOCUMENT START---\n` +
          input.source.markdown +
          `\n---DOCUMENT END---\n\n` +
          `위 모집요강을 분석해 admissionSpecSchema 형식의 JSON 한 개만 출력하세요. 베트남 순수외국인 필터 적용 필수.`,
      },
    ];
  }

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
      messages: [{ role: "user", content: userContent }],
    });
  } catch (e) {
    return {
      ok: false,
      error: `Anthropic API 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 응답 텍스트 추출
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "응답에 텍스트 블록이 없음" };
  }
  const raw = textBlock.text.trim();

  // JSON parse — 모델이 ```json 블록으로 감싸는 경우 stripping
  const jsonStr = stripCodeFence(raw);
  let parsedAny: unknown;
  try {
    parsedAny = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse 실패: ${e instanceof Error ? e.message : String(e)}`,
      raw,
    };
  }

  // zod 검증 — fail 해도 graceful: spec 그대로 반환 + warnings 로 운영자에게 노출
  const zres = admissionSpecSchema.safeParse(parsedAny);
  let spec: AdmissionSpec;
  let validationWarnings: string[] | undefined;

  if (zres.success) {
    spec = zres.data;
  } else {
    // 검증 실패해도 운영자가 검수 폼에서 직접 fix — raw spec 그대로 전달
    spec = parsedAny as AdmissionSpec;
    validationWarnings = zres.error.issues
      .slice(0, 15)
      .map((i) => `${i.path.join(".")}: ${i.message}`);
  }

  // 임시 신뢰도 — 검증 fail 시 감점
  const baseConfidence = estimateConfidence(spec);
  const confidence = validationWarnings
    ? Math.max(0, baseConfidence - 0.15)
    : baseConfidence;

  return {
    ok: true,
    spec,
    raw,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
    },
    confidence,
    validationWarnings,
  };
}

/** ```json ... ``` 또는 ``` ... ``` 펜스 stripping */
function stripCodeFence(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenced) return fenced[1].trim();
  return s;
}

/**
 * 핵심 필드의 채움 정도로 신뢰도 점수 (0~1).
 * 후속 라운드: 모델 결과 vs 재추출 결과 diff 기반 정교화.
 */
function estimateConfidence(spec: AdmissionSpec): number {
  let score = 1.0;
  // 핵심 필드 누락 = 큰 감점.
  //   zod 검증 실패 시 spec 구조가 보장되지 않으므로(옵셔널 체이닝 필수) —
  //   identity/departments 등이 통째로 없어도 크래시 없이 점수만 깎는다.
  if (!spec.identity?.university_name_ko) score -= 0.3;
  if (!spec.identity?.term) score -= 0.2;
  if (!spec.departments?.length) score -= 0.2;
  if (!spec.required_documents?.length) score -= 0.1;
  if (!spec.schedule?.semester_start) score -= 0.05;
  if (!spec.scholarships?.length) score -= 0.05;
  return Math.max(0, Math.min(1, score));
}
