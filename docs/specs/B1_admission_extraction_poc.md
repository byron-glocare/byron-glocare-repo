# B1-4 / 모집요강 AI 추출 PoC 설계

작성: 2026-05-26 · 출처: PLAN_B.md §7.1, §8.2 (study_admission_specs) · 관련: [B1_schema.sql](./B1_schema.sql)

> **목적**: 사용자가 실제 모집요강 N개를 제공하면 그것을 분석해서 `study_admission_specs.spec_data` 의 5개 JSONB 컬럼(`required_documents` / `eligibility` / `schedule` / `tuition` / `scholarships`) **내부 스키마를 확정**한다. PoC 가 산출하는 건 (1) 확정된 JSONB 스키마 (2) Claude Sonnet vision 프롬프트 초안 (3) B2 본격 자동화로 가기 위한 신뢰도·검수 패턴.
>
> **비목적**: B1 에선 정식 추출 파이프라인을 구현하지 않는다. 5~10건의 샘플로 스키마만 잠그는 게 목표. 자동화 UI / Job Queue / 대량 처리는 B2.

---

## 1. 입력 요구사항 (사용자가 제공할 것)

| 종류 | 권장 수량 | 형식 | 메모 |
|---|---|---|---|
| 모집요강 원본 | 5~10건 | PDF 또는 HWP | 가능하면 **다양한 대학** (서울권 + 지방권, 국립 + 사립 혼합). 같은 양식 반복은 피함 |
| 학기 | 2026-Spring 또는 2026-Fall | — | 한 학기로 통일하면 비교 쉬움 |
| 모집 대상 | 외국인 학부/대학원 모두 가능 | — | 글로케어 타겟 = **외국인 학부 정원 외 전형** 우선 |
| (선택) 글로케어가 이미 표준화한 기존 데이터 | 있다면 1~2건 | text/json | 비교 기준점으로 사용 |

> 사용자 액션: 이 PoC 진입 시점에 위 모집요강 5~10건을 한 폴더에 모아 경로 제공. 본 문서 §4 의 분석을 그 위에서 진행.

---

## 2. HWP 처리 결정

PLAN_B SESSION_HANDOFF 에서 "HWP=PDF 좌표 매핑" 결정 살아남았으나, Plan B 에선 **AI 원서 자동 생성이 빠졌으므로** 좌표 매핑까지는 불필요.

| 입력 형식 | 처리 |
|---|---|
| PDF | 그대로 Claude Sonnet vision 에 페이지별 이미지로 전달 |
| HWP | **변환 1단계만 필요**: HWP → PDF (LibreOffice 또는 ezPDF / hwp.js). 그 후 PDF 처리와 동일 |
| HWPX (.hwpx) | XML 기반이라 텍스트 직접 추출 가능. PDF 변환 우회 가능 |

좌표 매핑은 Plan A 의 "AI 가 PDF 신청서를 채우는" 기능 전용이었음. Plan B 의 모집요강 추출은 단방향(읽기)만 필요하므로 좌표 정보 불필요.

---

## 3. 분석 절차 (4단계)

### Step 1 — 1차 추출 (5~10건 일괄)
각 모집요강에 대해 Sonnet vision 호출, **느슨한 JSON** 으로 출력 받음 (스키마를 강제하지 않고 모델이 자연스럽게 추출하도록).

산출물: `step1_raw/<univ>_<dept>_<term>.json` 5~10개

### Step 2 — 공통/변동 필드 도출
Step 1 의 출력을 사람(=Claude+사용자 검토) 이 비교해서:
- **항상 존재하는 필드** = 핵심 스키마
- **일부에만 존재** = optional / extension 필드
- **표현이 다르지만 의미가 같은 필드** = 정규화 대상 (예: "TOPIK 3급 이상" vs "한국어능력시험 3급" → `eligibility.korean_proficiency.topik_min`)

산출물: `step2_field_inventory.md` — 필드별 출현률·정규화 매핑 표

### Step 3 — JSONB 스키마 확정 (zod로 작성)
Step 2 결과를 `src/lib/admission/spec-schema.ts` 에 zod 스키마로 작성. 이게 곧 `study_admission_specs.spec_data` 의 application 단 검증 스키마.

산출물: `src/lib/admission/spec-schema.ts` (코드) + `docs/specs/B2_admission_schema.md` (문서)

### Step 4 — 프롬프트 정규화 + 신뢰도 점수
확정된 스키마를 Sonnet 의 시스템 프롬프트에 박고, 다시 5~10건 추출 → Step 1 결과와 비교. 차이가 클수록 모델·프롬프트 보강 필요.

산출물: `src/lib/admission/extract.ts` (호출 함수 v1) + 신뢰도 평가 노트

---

## 4. 표준 스키마 초안 (PoC 시작점)

PLAN_B §7.1 의 6개 카테고리를 5개 JSONB 컬럼에 매핑 (학과는 row 의 `department_id` 가 표현하므로 JSONB 에서 제외):

```ts
// src/lib/admission/spec-schema.ts  (PoC Step 3 산출물 초안)
import { z } from "zod";

// 4.1 required_documents (JSONB array)
export const requiredDocumentSchema = z.object({
  key: z.string(),                              // 'transcript_high_school'
  name_ko: z.string(),                          // '고등학교 졸업증명서'
  name_vi: z.string().optional(),
  issuer: z.string().optional(),                // '한국 영사관' / '졸업학교' / '본인 작성'
  language: z.enum(["ko","en","vi","ko_or_en","any"]).optional(),
  required: z.boolean().default(true),
  notarization: z.enum(["none","notary","apostille","consul"]).optional(),
  notes: z.string().optional()
});

// 4.2 eligibility (JSONB object)
export const eligibilitySchema = z.object({
  nationality: z.array(z.string()).optional(),  // ISO codes; null = no restriction
  education_required: z.enum(["high_school","bachelor","master"]).optional(),
  gpa_min: z.number().optional(),               // 4.5 scale 또는 percent
  gpa_scale: z.enum(["4.5","4.0","100"]).optional(),
  korean_proficiency: z.object({
    topik_min: z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5),z.literal(6)]).optional(),
    alternative: z.string().optional()          // '교내 한국어 시험 통과' 등
  }).optional(),
  english_proficiency: z.object({
    toefl_ibt_min: z.number().optional(),
    ielts_min: z.number().optional(),
    duolingo_min: z.number().optional()
  }).optional(),
  age_max: z.number().optional(),
  notes_vi: z.string().optional(),
  notes_ko: z.string().optional()
});

// 4.3 schedule (JSONB object) — 날짜는 ISO date 문자열 또는 null
export const scheduleSchema = z.object({
  application_open: z.string().nullable(),
  application_close: z.string().nullable(),
  document_submission_close: z.string().nullable().optional(),  // 우편/방문 서류 마감 별도 있을 경우
  interview: z.string().nullable().optional(),
  interview_period: z.tuple([z.string(), z.string()]).optional(),
  result_announcement: z.string().nullable(),
  enrollment_period: z.tuple([z.string(), z.string()]).optional(),
  semester_start: z.string().nullable().optional()
});

// 4.4 tuition (JSONB object) — 통화는 KRW 가정, 단위는 원화 정수
export const tuitionSchema = z.object({
  currency: z.string().default("KRW"),
  application_fee: z.number().nullable().optional(),
  admission_fee: z.number().nullable(),         // 입학금
  tuition_per_semester: z.number().nullable(),  // 등록금 (학기)
  tuition_per_year: z.number().nullable().optional(),
  dorm_fee: z.number().nullable().optional(),
  other_fees: z.array(z.object({ name: z.string(), amount: z.number() })).optional(),
  notes: z.string().optional()
});

// 4.5 scholarships (JSONB array)
export const scholarshipSchema = z.object({
  name: z.string(),
  condition: z.string(),                        // '입학 성적 우수자' / 'TOPIK 5급 이상' 등
  benefit_type: z.enum(["tuition_pct","tuition_amount","admission_fee_waiver","stipend","dorm","other"]),
  benefit_value: z.union([z.number(), z.string()]),  // % 면 0.5, 정액이면 액수, 기타는 텍스트
  duration: z.string().optional(),              // '첫 학기' / '재학 중 전 학기' 등
  notes: z.string().optional()
});

export const admissionSpecDataSchema = z.object({
  required_documents: z.array(requiredDocumentSchema),
  eligibility: eligibilitySchema,
  schedule: scheduleSchema,
  tuition: tuitionSchema,
  scholarships: z.array(scholarshipSchema)
});
```

이 스키마는 **PoC 진입 전의 사전 가설**. Step 2~3 에서 실제 N건 분석 결과로 가감 확정. 그 후 B1_schema.sql 에 적힌 5개 JSONB 컬럼이 위 5개 sub-스키마와 1:1 대응됨을 application 단(zod)에서 검증.

---

## 5. Claude Sonnet vision 호출 패턴 (PoC v1)

> 정확한 SDK 사용 패턴은 `anthropic-skills:claude-api` 가이드 / `node_modules/@anthropic-ai/sdk` 참고. 여기서는 책임 범위만 명시.

`src/lib/admission/extract.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { admissionSpecDataSchema } from "./spec-schema";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";  // 본 시점 최신 안정 Sonnet

const SYSTEM_PROMPT = `
당신은 한국 대학의 외국인 입학 모집요강을 분석해 구조화된 JSON 으로 변환하는 전문가입니다.
출력은 반드시 admission_spec_data 스키마(다음 JSON Schema 참조)에 맞는 단일 JSON 만 반환하세요.
확신할 수 없는 필드는 null 로 비우고, 추측·창작 금지.
일정은 ISO 8601(YYYY-MM-DD), 금액은 정수(원화), TOPIK 급수는 정수.
모호한 표현(예: "수시")은 schedule.notes 가 아닌 별도 필드에 명시.
`;
// SYSTEM_PROMPT 는 prompt caching 대상 (Plan B §7.1 결정사항).

export async function extractAdmissionSpec(input: {
  pdfPages: Buffer[],          // 페이지별 PNG/JPEG (vision 입력)
  universityName: string,
  departmentName: string,
  term: string                 // '2026-Spring'
}) {
  // 1. 시스템 프롬프트 + JSON Schema (cache_control: ephemeral)
  // 2. user content: vision images + 메타 텍스트
  // 3. response_format: JSON
  // 4. 결과 zod 검증 → 실패 시 fields-missing 보고
  // 5. ai_extraction_log 에 { model, prompt_version, input_pages, confidence } 저장
}
```

**핵심 결정**:
- 모델: `claude-sonnet-4-6` (PoC), 비용 줄이려면 Haiku 후속 검증
- Prompt caching: SYSTEM_PROMPT + JSON Schema 부분
- 신뢰도 점수: 누락 필드 비율 × 가중치 (`schedule.application_close` 같은 핵심 필드 누락은 큰 감점)

---

## 6. PoC 결과로 결정될 항목

| # | 항목 | 결정 방식 |
|---|---|---|
| P-1 | `eligibility.education_required` 의 enum 값 확장 필요한가? | 실제 N건의 표현 다양성에 따라 |
| P-2 | `tuition.currency` 가 KRW 외 있는가? | 거의 없을 것으로 추정. 발견 시 schema 확장 |
| P-3 | `schedule` 에 추가해야 할 이벤트 type 있는가? | 예: 추가서류 마감, 추천서 마감 등 |
| P-4 | `scholarships.benefit_value` 의 enum 범위 | percentage / amount / boolean(전액·반액) 등 |
| P-5 | 모델 신뢰도 평균 | 80% 미만이면 prompt 보강 또는 vision pre-OCR 추가 |
| P-6 | 평균 추출 시간 / 비용 | 1건당 분/원화 추정 |

---

## 7. PoC 산출물 정리

```
docs/specs/
  ├─ B1_admission_extraction_poc.md   ← 본 문서
  └─ B2_admission_schema.md            ← PoC Step 3 결과 (스키마 확정 문서, 신규)

src/lib/admission/
  ├─ spec-schema.ts                    ← zod 스키마 (Step 3 확정)
  └─ extract.ts                        ← Sonnet vision 호출 함수 (Step 4 v1)

reports/admission_poc/
  ├─ step1_raw/                        ← N건의 1차 추출 JSON
  ├─ step2_field_inventory.md          ← 비교·정규화 표
  └─ step4_confidence_eval.md          ← 재추출 vs 1차 비교
```

---

## 8. B2 연결 (본격 자동화로 가는 다리)

B1-4 PoC 가 닫히면 B2 에서:
- 글로케어 운영팀이 내부 어드민(`glocare_customer_management`)에서 PDF 업로드 → 자동 추출 → 검수 화면 → 승인 → `study_admission_specs.status='approved'`
- AI 결과의 confidence < threshold 면 빨간색 강조 + 사람 수정 필수
- 같은 (university, department, term) 재추출 시 기존 row 와 diff 표시

이 UX 는 본 문서 범위 밖. **B1 단계에선 PoC 만 끝내고 스키마를 잠그는 게 핵심.**

---

## 9. PoC 진입 체크리스트

- [ ] 사용자가 모집요강 PDF/HWP 5~10건 제공 (경로 공유)
- [ ] HWP 변환 도구 결정 (LibreOffice CLI / hwp.js / 수동)
- [ ] Anthropic API key 환경변수 확인 (`ANTHROPIC_API_KEY`)
- [ ] `npm i @anthropic-ai/sdk` (현재 미설치)
- [ ] Step 1 1차 추출 스크립트 (`scripts/poc/step1_extract.ts`)
- [ ] Step 2 비교 → 사용자와 1회 검토 라운드
- [ ] Step 3 스키마 잠금 (`src/lib/admission/spec-schema.ts`)
- [ ] Step 4 재추출·신뢰도 보고
- [ ] PoC 종료: 스키마·프롬프트·신뢰도 보고서 commit
