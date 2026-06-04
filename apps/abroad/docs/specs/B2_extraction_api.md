# B2 / 모집요강 추출 API 명세

작성: 2026-05-27 · 관련: [extract.ts](../../src/lib/admission/extract.ts) · [spec-schema.ts](../../src/lib/admission/spec-schema.ts) · [B2_admission_schema.md](./B2_admission_schema.md)

> **호출자**: 글로케어 내부 어드민 (`glocare_customer_management` 저장소, https://glocare-admin.vercel.app/)
> **백엔드**: `glocare_homepage_abroad` (본 저장소)
> **분리 아키텍처**: 검수 UI 는 별도 저장소, AI 호출·zod 검증·향후 DB insert 는 본 저장소

---

## 1. Endpoint

```
POST https://youstudyinkorea.com/api/admission/extract
```

(개발: `http://localhost:3000/api/admission/extract`)

### 인증

```
X-Internal-Token: <env INTERNAL_API_TOKEN>
```

- 본 저장소(`glocare_homepage_abroad`)의 Vercel 환경변수 `INTERNAL_API_TOKEN` 에 임의 토큰 설정 (`openssl rand -hex 32` 추천)
- 글로케어 어드민(`glocare_customer_management`)의 환경변수에도 같은 값 설정 → fetch 헤더에 포함
- 401 = 토큰 누락/불일치, 500 = 서버에 토큰 미설정

### Content-Type

```
multipart/form-data
```

### Body 필드

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `file` | File (.pdf) | ✔ | 최대 20MB. HWP 는 호출 측에서 PDF 사전 변환 필요 (`@hwp/core` 또는 LibreOffice headless) |
| `university_name_ko` | string | ✔ | 한국어 대학명 (모델이 identity 보정에 사용) |
| `term` | string | ✔ | `YYYY-(Spring\|Fall\|Summer\|Winter\|Year)` 정규식 |
| `admission_category` | string | ✖ | 운영자가 명시한 전형 카테고리 (예: "순수외국인 특별전형"). 없으면 모델이 결정 |

---

## 2. 응답

### 성공 (200)

```ts
{
  ok: true,
  spec: AdmissionSpec,       // src/lib/admission/spec-schema.ts (zod 검증 통과)
  raw: string,               // 모델의 원본 텍스트 응답 (JSON parse 전)
  usage: {
    input_tokens: number,
    output_tokens: number,
    cache_read_input_tokens: number,
    cache_creation_input_tokens: number,
  },
  confidence: number,        // 0~1, 임시 (후속 라운드 정교화)
}
```

`spec` 구조 = [B2_admission_schema.md](./B2_admission_schema.md) 의 7섹션 (identity / departments / required_documents / eligibility / schedule / tuition / scholarships / metadata).

### 실패 (4xx, 5xx, 422)

| 상태 | 원인 |
|---|---|
| 400 | multipart 파싱 실패 / 필수 필드 누락 / PDF 확장자 아님 / term 형식 오류 |
| 401 | `X-Internal-Token` 누락·불일치 |
| 413 | PDF > 20MB |
| 422 | Anthropic API 호출 실패 / JSON parse 실패 / zod 검증 실패. `error` 에 사유 |
| 500 | 서버 환경 문제 (`INTERNAL_API_TOKEN` 미설정 등) |

응답 형식:
```ts
{
  ok: false,
  error: string,
  raw?: string,    // zod 실패 시 모델 raw output 도 포함 (검수 UI 가 운영자에게 표시 가능)
}
```

---

## 3. 검수 UI 측 사용 흐름 (`glocare_customer_management`)

```
1. 운영자: 모집요강 PDF 업로드 (글로케어 어드민 화면)
   + 학교 선택 (universities 조회) + 학기 선택 + admission_category 입력
   ↓
2. 어드민 → POST /api/admission/extract (with X-Internal-Token)
   ↓
3. 응답 받음:
   - ok=true → spec JSON 폼에 자동 채움
   - ok=false → raw output + error 표시, 운영자가 빈 폼에서 수동 입력
   ↓
4. 운영자: 폼 검토 + 수정 (필드별)
   ↓
5. "승인" 클릭 → 어드민 → Supabase 에 study_admission_specs row INSERT
   (status='approved', source_file_url, ai_extraction_log 함께 저장)
   ↓
6. /center/admissions 에서 유학센터 담당자에게 조회 가능
```

> **운영 흐름 원칙**: 사람이 빈 폼 처음부터 채우는 시나리오는 정상 운영에는 없음 — AI 결과 검수가 유일한 편집 진입점 (PLAN_B Decision #17).

---

## 4. 환경변수 (본 저장소 `.env.local` / Vercel)

| 키 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | extract.ts 가 자동 사용 — Sonnet 호출 |
| `INTERNAL_API_TOKEN` | 본 endpoint 의 인증 |

설정 절차:
```powershell
# 토큰 생성
$tok = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
Write-Host $tok
# Vercel 대시보드 → 본 프로젝트 → Settings → Environment Variables → INTERNAL_API_TOKEN
# 같은 값을 glocare_customer_management 프로젝트의 환경변수에도 추가
```

---

## 5. curl 테스트 예시

```bash
curl -X POST https://youstudyinkorea.com/api/admission/extract \
  -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  -F "file=@/path/to/모집요강.pdf" \
  -F "university_name_ko=서정대학교" \
  -F "term=2026-Spring" \
  -F "admission_category=순수외국인 입학전형 — 글로벌요양복지과"
```

응답을 `jq` 로 보기 좋게:
```bash
... | jq '.confidence, .usage, .spec.identity, .spec.departments[].name'
```

---

## 6. 비용 추정 (Sonnet 4.5 기준)

- PDF 1건 (10페이지 내외) 기준 input ~5-15K 토큰, output ~3-5K 토큰
- 시스템 프롬프트 (~3K 토큰) cache hit = 90% 비용 절감 (5분 내 재호출)
- 추정: 1건당 약 $0.03 - $0.10 (cache hit 가정 시 절반)

---

## 7. 다음 라운드 작업

- [ ] B2-3 — 글로케어 어드민(`glocare_customer_management`) 측 검수 UI (별도 세션)
- [ ] B2-4 — 신뢰도 점수 정교화 (재추출 vs 첫 추출 diff, 핵심 필드 weight)
- [ ] B2-5 — HWP 변환 endpoint (`/api/admission/hwp-to-pdf`) — `@hwp/core` 또는 LibreOffice
- [ ] B2-6 — 추출 로그 보관 (`study_admission_specs.ai_extraction_log` 형식 표준화)
