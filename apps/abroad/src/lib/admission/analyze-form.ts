/**
 * 양식 파일(HWP/HWPX/PDF) 자동 분석 (B4-7).
 *
 * Claude 가 양식을 읽고 추출:
 *   - 서술형 질문 목록 (essay_questions): 양식 안의 "○○에 대해 서술하시오" 같은 문항
 *   - 필요 데이터 타입 (required_data_type_keys): 양식이 학생에게 요구하는 정보
 *     → 운영자가 정의한 표준 카탈로그 키 중에서 매칭
 *
 * 결과는 운영자 검수 후 form_files DB 에 저장됨.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { detectFormat, hwpToMarkdown, HwpxReader } from "@ssabrojs/hwpxjs";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;

export type AvailableDataType = {
  key: string;
  label_ko: string;
  category: string;
  is_essay_basis: boolean;
};

export type AnalyzeFormInput = {
  fileBuffer: Buffer;
  fileName: string;
  /** 표준 카탈로그 — Claude 가 이 키들 중에서 선택 */
  availableDataTypes: AvailableDataType[];
};

export type SuggestedMissingDataType = {
  /** snake_case 식별자 (Claude 가 제안) */
  key: string;
  label_ko: string;
  label_vi: string;
  category:
    | "identity"
    | "education"
    | "family"
    | "financial"
    | "language"
    | "contact"
    | "career"
    | "essay"
    | "document"
    | "other";
  input_type:
    | "text"
    | "long_text"
    | "date"
    | "number"
    | "select"
    | "multi_select"
    | "file"
    | "boolean";
  hint_ko?: string;
  /** 왜 이 양식에서 필요한지 운영자 설명용 */
  reason?: string;
};

export type EssaySubQuestion = {
  /** 학생에게 보여줄 친근한 한국어 질문 (참고) */
  question_ko: string;
  /** 학생/센터가 실제 보는 베트남어 질문 (학생 친화 톤) */
  question_vi: string;
  /** 답변 가이드 (베트남어) */
  hint_vi?: string;
  /** 답변이 저장될 카탈로그 키 (재사용성). 없으면 양식 전용 답변 */
  data_type_key?: string;
};

export type AnalyzeFormResult =
  | {
      ok: true;
      essay_questions: Array<{
        question_ko: string;
        max_chars?: number;
        basis_data_type_keys: string[];
        /** ★ 학생에게 친근하게 묻는 sub-question 들 (양식별 맞춤) */
        sub_questions: EssaySubQuestion[];
      }>;
      suggested_required_data_keys: string[];
      missing_data_types: SuggestedMissingDataType[];
      detected_format: "hwp" | "hwpx" | "pdf";
      analysis_notes: string;
      raw: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `당신은 한국 대학의 외국인 학생 입학 양식을 분석하는 전문가입니다.

# 역할

업로드된 양식(입학원서·자기소개서·학업계획서·재정보증서 등)을 분석해서:
1. **서술형 질문 추출** — 양식 안에 있는 "○○에 대해 서술하시오", "왜 ○○인가요?" 같은 essay 문항
2. **필요 데이터 추출** — 양식이 학생에게 요구하는 모든 정보 항목 (이름·생년월일·여권번호·부모 직업·재정보증 금액 등)

# 출력 형식

**반드시 단일 JSON 만** 출력. 다른 텍스트(설명·마크다운·코드블록) 절대 금지.

\`\`\`json
{
  "detected_essay_questions": [
    {
      "question_ko": "자기 소개(취미, 특기, 인생관, 성장과정, 가족환경 등)를 자유롭게 서술하시오. (1000자 이내)",
      "max_chars": 1000,
      "basis_data_type_keys": ["essay_hobby_talent", "essay_personal_style", "essay_growing_up", "essay_family_background"],
      "sub_questions": [
        {
          "question_ko": "본인의 취미나 특기를 간단히 알려주세요.",
          "question_vi": "Sở thích hoặc sở trường của bạn là gì? Hãy kể đơn giản.",
          "hint_vi": "Hoạt động yêu thích hàng ngày, không cần liên quan đến đại học.",
          "data_type_key": "essay_hobby_talent"
        },
        {
          "question_ko": "본인의 스타일을 알려주세요. (성격·가치관)",
          "question_vi": "Phong cách của bạn? Tính cách, giá trị bạn coi trọng.",
          "hint_vi": "Viết tự nhiên như giới thiệu với bạn bè.",
          "data_type_key": "essay_personal_style"
        },
        {
          "question_ko": "성장과정을 간단히 알려주세요.",
          "question_vi": "Quá trình trưởng thành của bạn? Hãy kể đơn giản.",
          "hint_vi": "Trải nghiệm lớn từ nhỏ đến giờ, sự kiện/người có ảnh hưởng.",
          "data_type_key": "essay_growing_up"
        },
        {
          "question_ko": "가족을 소개해주세요. 특별한 점이 있다면 꼭 알려주세요.",
          "question_vi": "Giới thiệu gia đình bạn. Có điều gì đặc biệt thì hãy chia sẻ.",
          "data_type_key": "essay_family_background"
        }
      ]
    }
  ],
  "suggested_required_data_keys": ["full_name_ko", "passport_no", ...],
  "missing_data_types": [
    {
      "key": "foreign_registration_no",
      "label_ko": "외국인등록번호",
      "label_vi": "Mã số đăng ký người nước ngoài",
      "category": "identity",
      "input_type": "text",
      "hint_ko": "한국에서 외국인등록증 발급 후 부여되는 13자리 번호",
      "reason": "양식의 신원 정보 필수 입력란"
    }
  ],
  "analysis_notes": "양식 분석 시 발견한 특이사항 (한국어 짧게)"
}
\`\`\`

# 규칙

## 핵심: sub_questions 가 시스템의 차별화 가치

학생이 양식의 격식 있는 원 질문 ("자기 소개(취미·특기·인생관·성장과정·가족환경 등)") 에 곧바로 답하기 어렵다. 그래서 AI 가 **양식별 맞춤 sub-question 들** 을 친근한 톤으로 분해 생성해야 한다. 학생/유학센터는 그 sub-question 에 편안하게 답하고, **다른 AI 가 양식의 격식 답변으로 조합** 한다.

⭐ sub_questions 생성 규칙:
- 양식의 원 질문이 여러 sub-topic 을 묶어 묻는 경우 (괄호로 "(취미, 특기, 인생관, 성장과정, 가족환경)" 나열) → **각 sub-topic 별로 sub_question 1개씩** 분리해서 생성. 학생이 한 번에 다 답하라고 하지 말 것.
- 양식이 단일 주제로 묻는 경우도 → 답변 작성에 필요한 정보를 묻는 sub-question 1-3개로 분해. 예: "지원 동기와 학업 계획" → "이 학과에 끌린 이유? / 입학 후 학기별로 무엇을 하고 싶은지?"
- **친근 톤**: "~를 자유롭게 알려주세요", "~에 대해 간단히 말해주세요" 같은 부드러운 표현. 학생 친화. 어려운 격식 단어 (인생관 → 스타일·가치관) 풀어쓰기.
- **베트남어 (question_vi)**: 학생/센터 담당자가 실제 보는 텍스트. 자연스러운 베트남어.
- **hint_vi (선택)**: 답변 가이드 — "예시", "어떤 점을 적어야 하나" 등.
- **data_type_key**: 답변이 저장될 카탈로그 키. 가능하면 essay 카테고리의 키 사용 (재사용성). 매칭되는 키 없으면 생략.

# 규칙

1. **basis_data_type_keys 매핑** (가장 중요): 각 서술형 질문에 대해 \`is_essay_basis: true\` 인 카탈로그 키들을 **여러 개 매핑**. 양식의 한 질문이 여러 sub-topic 을 묶어서 묻는 경우 (괄호 안에 "(취미, 특기, 인생관, 성장과정, 가족환경)" 같이 나열) 각 sub-topic 에 해당하는 키를 **모두** 매핑.

   매핑 예시:
   - "자기 소개(취미, 특기, 인생관, 성장과정, 가족환경)" →
     **모두 매핑**: essay_hobby_talent, essay_personal_style, essay_growing_up, essay_family_background, essay_strengths_weakness
     (학생은 각 키에 친근하게 답하고, 다른 AI 가 작문 시 양식 원 질문에 맞게 조합함)
   - "한국 유학을 결심하게 된 계기" → essay_motivation_korea, essay_korea_culture_exp
   - "지원 동기와 입학 후 학업계획" → essay_major_motivation, essay_study_plan_basis
   - "졸업 후 진로 계획" → essay_career_plan
   - "성장과정과 가족 소개" → essay_growing_up, essay_family_background
   - "본인의 장단점" → essay_strengths_weakness
   - "특별한 경험·활동" → essay_special_experience

   ⭐ 핵심 원칙: 양식의 큰 질문이 여러 sub-topic 을 묶어 묻는 경우 **카탈로그의 잘게 쪼개진 키 여러 개** 를 매핑하라. 학생이 각 키별로 친근하게 답하면 AI 가 양식 격식 답변으로 조합한다.

2. **suggested_required_data_keys** — 의미 매칭 우선: 양식이 요구하는 정보가 카탈로그의 키와 **의미상 같거나 포함되면** 그 키 사용. 정확히 같은 단어가 아니어도 의미만 통하면 매칭. 예:
   - 양식: "보호자 연락처" → father_contact, mother_contact (양쪽 다, 양식이 부/모 구분 안 했으면)
   - 양식: "주소" / "현주소" / "거주지" → residence_addr_vn
   - 양식: "거주 도시" → residence_city_vn
   - 양식: "보호자 직업" / "부모 직업" → father_occupation, mother_occupation
   - 양식: "이름" → full_name_ko + full_name_en + full_name_vi (한국식·영문·베트남식 표기는 보통 한 양식에서 다 요구)
   - 양식: "고등학교" → highschool_name + highschool_grad_date + highschool_gpa (관련 모두)
   - 양식: "은행 잔고" / "재정증명" → bank_balance_amount + bank_name + financial_proof_issued
   - 모호하면 가장 포괄적인 키 1개 또는 관련 2-3개 매칭.

3. **missing_data_types** ⭐: 양식이 요구하는 정보 중 **카탈로그 키 중 어떤 것에도 의미적으로 매칭 안 되는 것**만 여기에. 단순히 단어가 다르다고 missing 으로 빼지 말 것 (그건 #2 에서 의미 매칭). 진짜 카탈로그에 개념 자체가 없는 항목만 (예: "외국인등록번호", "비자 만기일", "한국어 교육 이수 이력" 등 한국 거주 외국인 특화 항목).
   - \`key\`: snake_case 영문 (예: "foreign_registration_no", "current_visa_expiry", "korean_education_history"). 카탈로그 기존 key 와 중복 금지.
   - \`label_ko\`: 한국어 정식 명칭
   - \`label_vi\`: 베트남어 번역 (최선)
   - \`category\`: identity / education / family / financial / language / contact / career / essay / document / other 중 하나
   - \`input_type\`: text / long_text / date / number / select / multi_select / file / boolean 중 적합한 것
   - \`hint_ko\`: 유학센터 담당자가 입력 시 참고할 안내
   - \`reason\`: 이 양식의 어느 부분에 필요한지 짧게

4. **max_chars**: 양식에 글자수 제한이 명시되어 있을 때만 채움. 없으면 필드 자체를 생략.

5. **베트남 순수외국인 필터**: 외국인 전용·중국·F-4 등 다른 국적 전용 항목은 추출 X.

6. **빈 양식**: 양식이 단순 동의서·체크리스트라 서술형 문항이 없으면 detected_essay_questions = []. 데이터 요구 항목도 거의 없으면 suggested_required_data_keys = [].

7. **이름/생년월일 같은 기본 정보**는 거의 모든 양식이 요구하므로 빠뜨리지 말 것.

8. **확신 없는 매핑은 빼는 게 안전**. 운영자가 검수 후 직접 추가할 수 있음.

9. **missing_data_types 키는 영어 snake_case 만**: 한국어/공백/대문자 금지. 일반적 명명 규칙 따를 것.`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  // process.env 값의 leading/trailing quotes·whitespace 제거 (Next.js dotenv 일부 케이스 대응)
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    throw new Error(
      `ANTHROPIC_API_KEY not set (raw length=${raw.length}, trimmed length=${key.length})`
    );
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

/** 표준 카탈로그를 프롬프트에 넣을 형태로 직렬화 */
function formatCatalog(types: AvailableDataType[]): string {
  // category 별로 그룹
  const byCategory = new Map<string, AvailableDataType[]>();
  for (const t of types) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }
  const lines: string[] = [];
  for (const [cat, items] of byCategory.entries()) {
    lines.push(`## ${cat}`);
    for (const t of items) {
      const tag = t.is_essay_basis ? " [essay_basis]" : "";
      lines.push(`- \`${t.key}\` — ${t.label_ko}${tag}`);
    }
  }
  return lines.join("\n");
}

export async function analyzeFormFile(
  input: AnalyzeFormInput
): Promise<AnalyzeFormResult> {
  const data = new Uint8Array(input.fileBuffer);
  const lower = input.fileName.toLowerCase();
  const isPdf = lower.endsWith(".pdf");

  let detectedFormat: "hwp" | "hwpx" | "pdf";
  let userContent: Anthropic.MessageCreateParams["messages"][number]["content"];
  const catalogText = formatCatalog(input.availableDataTypes);

  if (isPdf) {
    detectedFormat = "pdf";
    const pdfBase64 = input.fileBuffer.toString("base64");
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
          `# 표준 데이터 카탈로그 (이 키들만 사용 가능)\n\n${catalogText}\n\n` +
          `# 작업\n위 양식 PDF 를 분석해 단일 JSON 출력. 서술형 질문 + 필요 데이터 키를 추출.`,
      },
    ];
  } else {
    // HWP / HWPX → Markdown
    const fmt = detectFormat(data);
    if (fmt === "unknown") {
      return { ok: false, error: "HWP/HWPX/PDF 형식이 아닙니다" };
    }
    if (fmt === "hwp3") {
      return { ok: false, error: "HWP 3.0 은 지원하지 않습니다" };
    }

    let markdown: string;
    try {
      if (fmt === "hwpx") {
        const reader = new HwpxReader();
        const ab = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength
        ) as ArrayBuffer;
        await reader.loadFromArrayBuffer(ab);
        markdown = await reader.extractMarkdown();
        detectedFormat = "hwpx";
      } else {
        markdown = await hwpToMarkdown(data);
        detectedFormat = "hwp";
      }
    } catch (e) {
      return {
        ok: false,
        error: `HWP 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    userContent = [
      {
        type: "text",
        text:
          `# 표준 데이터 카탈로그 (이 키들만 사용 가능)\n\n${catalogText}\n\n` +
          `# 양식 내용 (${detectedFormat.toUpperCase()} → Markdown)\n\n` +
          `---FORM START---\n${markdown}\n---FORM END---\n\n` +
          `# 작업\n위 양식을 분석해 단일 JSON 출력. 서술형 질문 + 필요 데이터 키를 추출.`,
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
      error: `Claude 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "응답에 텍스트 없음" };
  }

  const raw = textBlock.text.trim();
  const jsonStr = stripCodeFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      error: `JSON parse 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 검증
  const p = parsed as {
    detected_essay_questions?: Array<{
      question_ko?: string;
      max_chars?: number;
      basis_data_type_keys?: string[];
      sub_questions?: Array<{
        question_ko?: string;
        question_vi?: string;
        hint_vi?: string;
        data_type_key?: string;
      }>;
    }>;
    suggested_required_data_keys?: string[];
    missing_data_types?: Array<{
      key?: string;
      label_ko?: string;
      label_vi?: string;
      category?: string;
      input_type?: string;
      hint_ko?: string;
      reason?: string;
    }>;
    analysis_notes?: string;
  };

  const validKeys = new Set(input.availableDataTypes.map((t) => t.key));
  const essayBasisKeys = new Set(
    input.availableDataTypes.filter((t) => t.is_essay_basis).map((t) => t.key)
  );

  const VALID_CATEGORIES = new Set([
    "identity",
    "education",
    "family",
    "financial",
    "language",
    "contact",
    "career",
    "essay",
    "document",
    "other",
  ]);
  const VALID_INPUT_TYPES = new Set([
    "text",
    "long_text",
    "date",
    "number",
    "select",
    "multi_select",
    "file",
    "boolean",
  ]);

  // essay_questions 정리 (sub_questions 포함)
  const essay_questions = (p.detected_essay_questions ?? [])
    .filter(
      (q): q is {
        question_ko: string;
        max_chars?: number;
        basis_data_type_keys?: string[];
        sub_questions?: Array<{
          question_ko?: string;
          question_vi?: string;
          hint_vi?: string;
          data_type_key?: string;
        }>;
      } => typeof q?.question_ko === "string" && q.question_ko.trim() !== ""
    )
    .map((q) => {
      // sub_questions 검증
      const subs: EssaySubQuestion[] = (q.sub_questions ?? [])
        .filter(
          (s): s is {
            question_ko: string;
            question_vi: string;
            hint_vi?: string;
            data_type_key?: string;
          } =>
            typeof s?.question_ko === "string" &&
            s.question_ko.trim() !== "" &&
            typeof s.question_vi === "string" &&
            s.question_vi.trim() !== ""
        )
        .map((s) => ({
          question_ko: s.question_ko,
          question_vi: s.question_vi,
          ...(s.hint_vi ? { hint_vi: s.hint_vi } : {}),
          // data_type_key 는 카탈로그에 있는 키만 (없으면 생략)
          ...(s.data_type_key && essayBasisKeys.has(s.data_type_key)
            ? { data_type_key: s.data_type_key }
            : {}),
        }));

      return {
        question_ko: q.question_ko,
        ...(typeof q.max_chars === "number" && q.max_chars > 0
          ? { max_chars: q.max_chars }
          : {}),
        basis_data_type_keys: (q.basis_data_type_keys ?? []).filter((k) =>
          essayBasisKeys.has(k)
        ),
        sub_questions: subs,
      };
    });

  const suggested_required_data_keys = (
    p.suggested_required_data_keys ?? []
  ).filter((k) => typeof k === "string" && validKeys.has(k));

  // missing_data_types 검증·필터 — 이미 있는 키 제외, 형식 valid 한 것만
  const missing_data_types: SuggestedMissingDataType[] = (
    p.missing_data_types ?? []
  )
    .filter(
      (m): m is {
        key: string;
        label_ko: string;
        label_vi: string;
        category: string;
        input_type: string;
        hint_ko?: string;
        reason?: string;
      } =>
        typeof m?.key === "string" &&
        /^[a-z][a-z0-9_]*$/.test(m.key) &&
        !validKeys.has(m.key) &&
        typeof m.label_ko === "string" &&
        m.label_ko.trim() !== "" &&
        typeof m.label_vi === "string" &&
        m.label_vi.trim() !== "" &&
        typeof m.category === "string" &&
        VALID_CATEGORIES.has(m.category) &&
        typeof m.input_type === "string" &&
        VALID_INPUT_TYPES.has(m.input_type)
    )
    .map((m) => ({
      key: m.key,
      label_ko: m.label_ko,
      label_vi: m.label_vi,
      category: m.category as SuggestedMissingDataType["category"],
      input_type: m.input_type as SuggestedMissingDataType["input_type"],
      hint_ko: m.hint_ko,
      reason: m.reason,
    }));

  return {
    ok: true,
    essay_questions,
    suggested_required_data_keys,
    missing_data_types,
    detected_format: detectedFormat,
    analysis_notes:
      typeof p.analysis_notes === "string" ? p.analysis_notes : "",
    raw,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

function stripCodeFence(s: string): string {
  const fenced = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenced) return fenced[1].trim();
  return s;
}
