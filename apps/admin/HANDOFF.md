# Admin (glocare_customer_management) — 새 Claude Code 세션 인계

이 문서는 **새 Claude Code 채팅** 시작할 때 컨텍스트 빠르게 잡으라고 만든거야.
파일 전부 다 읽지 말고 이 문서만 보고 바로 작업 시작할 수 있게 정리.

---

## 🚚 OneDrive → C:\dev 이사 (진행 중) — 새 세션 먼저 확인

- 바탕화면이 OneDrive로 redirect 돼 있어 dev 느림/파일 eviction 발생 → **모든 프로젝트를 `C:\dev\`로 이동** 결정.
- **이사 스크립트 준비됨**: `C:\dev\이사_실행.bat` (더블클릭) 또는 `C:\dev\move_projects_from_onedrive.ps1`.
  - node_modules/.next/.turbo/dist 는 삭제 후 이동(가볍게) → 새 위치서 `npm install` 로 복구.
  - 대상 5개: analyzer, glocare_customer_management, glocare_homepage, glocare_homepage_abroad, glocare-homepage-caregiver.
- **Claude Code 메모리는 미리 새 키로 복사 완료**: `~/.claude/projects/C--dev-glocare-customer-management/memory` (+ homepage, abroad).
- **이사 후 할 일**: ① `C:\dev\glocare_customer_management` 에서 Claude Code 다시 열기 ② `npm install` ③ 메모리 `dev_onedrive_slow_fs` 갱신/삭제(해결됨) ④ 이 HANDOFF의 경로들 `C:\dev\...` 로 갱신.
- ⚠️ 이사 실행 전 Claude Code·에디터·dev 서버 **전부 닫기** (파일 잠김 방지).

---

## ▶ 진행 중 작업 (2026-06-04 업데이트) — 새 세션은 여기부터

### 커밋 상태
- `main`이 `origin/main`보다 **로컬 커밋 6개 앞섬** (push 안 함 — 배포는 운영자 테스트·개선 후).
- 최근 로컬 커밋: `32d37eb`(B1 대학 기준 입학서류 통합), `0463c8c`(자동생성 학과 course 교정), `11610b5`(Flow B 추출 프리필+빠른수정), `ec02e79`(Flow B), `07a9299`(유학 개편 전체+마이그레이션).
- push 하면 Vercel 자동배포로 프로덕션 반영됨 → **운영자 명시 요청 시에만**.

### ⚠️ 추출 기능 환경 (B7) — 해결됨
- 모집요강/Flow B의 AI 추출은 형제 레포 `glocare_homepage_abroad`의 `/api/admission/extract`를 호출.
- `.env.local`의 `EXTRACTION_API_URL=http://127.0.0.1:3001/api/admission/extract` (로컬 3001).
- **추출 테스트하려면 abroad 프로젝트를 3001로 띄워야 함.** ⚠️ 단 abroad `.env.local`(Vercel CLI 생성)의 `ANTHROPIC_API_KEY`가 Next dotenv 로 안 잡히는 케이스가 있어("ANTHROPIC_API_KEY ... not set") → **실행 시 키를 직접 주입**:
  ```powershell
  Set-Location "C:\Users\kajka\OneDrive\Desktop\glocare_homepage_abroad"
  $raw = Get-Content .env.local
  function Val($k){ $l=$raw|?{$_ -match "^$k="}|select -First 1; if($l){($l -replace "^$k=","").Trim().Trim('"')} }
  $env:ANTHROPIC_API_KEY = Val 'ANTHROPIC_API_KEY'; $env:INTERNAL_API_TOKEN = Val 'INTERNAL_API_TOKEN'
  npm run dev -- -p 3001
  ```
  - INTERNAL_API_TOKEN 은 admin↔abroad 일치 확인됨(인증 통과).
  - ⚠️ (b) 운영 `youstudyinkorea.com/api/admission/extract`는 **API 미배포**(홈페이지 HTML 반환) → 안 됨. 반드시 로컬 3001.
- 즉 추출 관련 테스트 시 dev 서버 **2개** 필요: admin :3000 + abroad :3001.

### 남은 작업 (우선순위 순)
1. ~~**B1 — 모집요강+양식파일 통합**~~ ✅ 완료(`32d37eb`): `/admissions`=입학서류 홈(대학 목록), `/admissions/[universityId]`=대학별 [모집요강+필수서류+양식] 통합, spec 상세는 `/admissions/specs/[id]`, `/admissions/forms`는 redirect, nav `모집요강`→`입학서류`. (남은 nav 정리 `학과`→`대학교-학과` 등은 #6/A에서.)
2. **B2 — 양식 종류 다중선택**: 업로드 시 양식 종류를 드롭다운→**체크박스 다중선택**(예: 동남보건대 자소서+학업계획서 1파일). 같은 종류 기존 업로드 있으면 **업로드 일자 표시** + 체크 시 **alert**(이미 있음 경고).
3. **B3 — 필수서류 연동**: 모집요강 `required_documents` 기반으로 어떤 양식이 필요한지 + **필수 여부** 표시. 대학별 요구서류를 고려해 양식 관리하도록 유도.
4. **A6 — 사례+SNS채널 통합**: 메뉴 1개 + 페이지 1개, 안에서 **탭**으로 분리(`/study-cases`, `/study-channels` 기능 유지).
5. **A7-9 — 유학 B2B 구조 개편** (DB 스키마 변경 SQL 필요):
   - `유학센터 회사`(center-orgs) 메뉴 제거 → 기존 `study_centers` DB를 확장해 흡수.
   - `가격 플랜`(pricing-plans) 별도 등록·매칭 구조 제거 → **유학센터 세부 관리로 통합**. 유학센터별로 설정하되 기존 유학센터 정보 **자동완성**.
   - `인보이스`→`정산`(라벨 변경 완료, 내용 개편은 후속).
   - `유학 B2B 정산` 그룹 제거 → `유학` 그룹으로 통합.

### 환경/협업 (반드시)
- DB는 단일 라이브 Supabase(`oczjvsxmlbuicyhheelc`) 공유, 코드만 dev/prod 분리. **추가는 안전(active=false 등 노출 게이팅), 삭제만 금지.**
- DB 변경은 **SQL 써주면 운영자가 Supabase SQL 에디터에 붙여넣음** (CLI/db pull/비번 제안 금지).
- 로컬 실행은 **PowerShell 직접**. 검증은 운영자 Chrome(`localhost:3000`) 또는 인증 fetch. (OneDrive라 preview 브라우저 얼어붙음)
- 무거워지면 **세션 바꾸지 말고 `/compact`**.
- 자세한 규칙: 레포 `WORKING_WITH_CLAUDE.md` (CLAUDE.md @import).

---

## 프로젝트 한 줄

**Glocare 통합 어드민** — 요양보호사 + 유학생 도메인 CRM.
- Production: `https://glocare-customer.vercel.app`
- Vercel 프로젝트 이름: **glocare_admin** (이름 변경됨, 환경변수는 여기에)
- Repo 위치: `C:\Users\kajka\OneDrive\Desktop\glocare_customer_management\`

---

## 형제 프로젝트 (참고용, 같이 안 건드림)

| 프로젝트 | 위치 | 도메인 | 용도 |
|---|---|---|---|
| 유학 홈페이지 | `glocare_homepage_abroad` | youstudyinkorea.com | 유학생 대상 공개 사이트 |
| 요양보호사 홈페이지 | `glocare-homepage-caregiver` | glocare.co.kr (작업중) | 회원제 (SNS 로그인 + CBT + 영상 + 이력서) |
| 어드민 (이 프로젝트) | `glocare_customer_management` | glocare-customer.vercel.app | 양쪽 도메인 데이터 관리 |

---

## ⚠️ 기술 제약 (반드시 지킴)

- **Next.js 16** — 학습한 데이터와 다름. 의심나면 `node_modules/next/dist/docs/` 가이드 먼저 읽기 (AGENTS.md 명시)
- **App Router + Turbopack**
- **Tailwind CSS 4** — design token 기반 (`--primary`, `--coral` 등). admin 은 `--primary`, homepage 만 `--coral` 토큰 있음 (혼동 주의)
- **Supabase** — Auth + DB + RLS
- **공개 signup 금지** — admin 은 모든 페이지 auth 보호
- **NHN SMS** — 이 계정은 LMS 가 아니라 MMS 엔드포인트 사용 (2026-04-23 이슈 해결됨)

---

## 디렉토리 구조 핵심

```
src/
├─ app/
│  ├─ (app)/                    ← auth 보호 그룹
│  │  ├─ layout.tsx             ← 사이드바 (요양보호사 / 유학생 그룹)
│  │  ├─ page.tsx               ← 대시보드 (양쪽 도메인 stats)
│  │  ├─ customers/             ← 요양보호사 교육생
│  │  ├─ training-centers/
│  │  ├─ care-homes/
│  │  ├─ consultations/
│  │  ├─ settlements/
│  │  ├─ sms/
│  │  ├─ settings/
│  │  ├─ universities/          ← 유학 도메인 시작
│  │  ├─ departments/
│  │  ├─ study-centers/
│  │  ├─ study-cases/           ← 사례 (TikTok 영상 포함)
│  │  ├─ study-channels/        ← SNS 채널
│  │  └─ students/              ← 유학생 inbox (상담/보험 탭)
│  ├─ api/
│  └─ login/
├─ lib/
│  ├─ nav.ts                    ← 사이드바 메뉴 정의
│  ├─ validators.ts             ← Zod 스키마 (append-only 로 관리)
│  ├─ supabase/                 ← server/browser client
│  ├─ require-auth.ts           ← 페이지 가드
│  └─ ... (도메인 별 로직)
└─ components/
supabase/
└─ migrations/                  ← 0001 ~ 0010
```

---

## 데이터베이스 (Supabase)

### 마이그레이션 히스토리
| # | 내용 |
|---|---|
| 0001 | init schema (요양보호사) |
| 0002 | settings + status options seed |
| 0003 | dummy data (+ rollback) |
| 0004 | class_schedule + resume_sent flags |
| 0005 | consultation_tags |
| 0006 | contract_active + code_reissue |
| 0007 | settlement restructure |
| 0008 | class_intake_sms_sent flag |
| **0009** | **study_abroad schema** (universities/departments/centers/cases/channels/contacts/insurance_claims) |
| **0010** | study_cases.hero text (1/2/3/N 위치 코드) |

### 현재 git 상태 (참고)
- branch: `main`, up to date with origin
- **uncommitted**: `supabase/migrations/0009_study_abroad_schema.sql` 수정됨
- untracked: `glocare_homepage/` (이건 무시)

---

## 최근 작업 히스토리 (최신 → 과거)

```
88ee342  chore(qc): 종합 QC 시트 + bg-coral → bg-primary 수정
f322da5  refactor(admin): 유학 리스트 UI 를 요양보호사 패턴으로 통일
c4f0fef  feat(dashboard): 유학생 도메인 통계 카드 6종 추가
05fe45e  feat(admin): 유학 도메인 전체 CRUD — universities/departments/centers/channels + inbox 상태 편집
f14fbd7  feat(study-cases): 사례 CRUD admin 페이지 추가
1f8a85c  feat(study-cases): hero 컬럼을 boolean → text 로 (위치 코드)
7b6c9de  feat(study-abroad): 유학 도메인 스키마 + admin 페이지 3개 활성화
4689b3b  feat(ui): 사이드바 대분류 + 고객관리→교육생 + 유학생 placeholder + 신규/기존 고객 라디오
43adc29  feat(progress): 강의 접수 SMS = 수기 플래그 + 자동 발송 후 ON 팝업
```

**요약**: 최근에는 유학 도메인 admin CRUD 6종 (대학/학과/센터/사례/채널/inbox) 추가하고, UI 를 요양보호사 패턴으로 통일하고, 종합 QC 했음.

---

## 환경변수 (Vercel)

**프로젝트**: `glocare_admin` (이름 변경됨)

| key | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side 작업용 |
| `RESEND_API_KEY` | 이메일 발송 |
| `RESEND_FROM_EMAIL` | help@glocare.co.kr |
| `RESEND_NOTIFY_EMAIL` | kajkaj202@gmail.com |
| NHN SMS 관련 키들 | (MMS 엔드포인트 사용) |

⚠️ admin 환경변수와 caregiver 홈페이지 환경변수는 Vercel 프로젝트가 다름 (이전에 헷갈려서 잘못 넣은 적 있음).

---

## 이메일 발송 (Resend)

- 발송자: `help@glocare.co.kr`
- 받는 사람: 시스템에 등록된 이메일
- 운영자 알림: kajkaj202@gmail.com
- AWS SES → Resend 로 변경됨
- **언어 순서 (사용자 지정)**:
  - 제목: 베트남어 먼저, 한국어 나중
  - 본문: **한국어 먼저**, 베트남어 나중
- 트리거 위치:
  - 유학 홈페이지 상담 신청 → `/api/...` (study_contacts insert)
  - 유학 홈페이지 제휴 신청 → 같은 endpoint, recruiting='partner'
  - 보험 환급 → study_insurance_claims

---

## 디자인 토큰 주의사항

| 토큰 | admin | homepage |
|---|---|---|
| `--primary` (#ff6060) | ✅ | ✅ |
| `--coral` | ❌ 없음 | ✅ |

**bg-coral 을 admin 에 쓰면 무색**. `bg-primary` 사용. (이전에 study-cases HeroBadge 에서 한 번 발생)

---

## QC 시트 위치

`QC.md` (repo root) — 24 섹션, 양 쪽 도메인 + admin + homepage 통합 체크리스트.
구조:
- ① 정적 검증 (자동) — tsc / build / lint / git
- ②~⑨ admin 페이지별
- ⑩~⑳ homepage 페이지별
- ㉑~㉓ i18n / API / 데이터 연결
- ㉔ 외부 의존성

---

## 알려진 이슈 (QC.md ➝ "발견된 이슈" 섹션)

| # | 위치 | 우선순위 | 상태 |
|---|---|---|---|
| 1 | study-cases HeroBadge `bg-coral` → `bg-primary` | 중 | ✅ 수정 |
| 2 | homepage 구 라우트 (`/apply`, `/cases`, `/centers`, `/insurance`, `/universities`, `/universities/[id]`) — 새 디자인은 단일 페이지 + 앵커 사용. 직접 URL 접근 시 깨짐 | 낮 | ⬜ 삭제 or redirect 결정 필요 |
| 3 | homepage `contact-form.tsx`, `insurance-form.tsx` 구 폼 컴포넌트 — 더이상 import 안 됨 | 낮 | ⬜ 삭제 후보 |
| 4 | homepage `locale-switch.tsx` 구 컴포넌트 — `lang-bar.tsx` 로 대체됨 | 낮 | ⬜ 삭제 후보 |
| 5 | admin lint 33 errors — 기존 파일 (test 파일 등), 새로 만든 파일은 0 errors | 낮 | ⚠️ 청소만 하면 됨 |
| 6 | homepage `bg-card`, `text-muted-foreground` shadcn 토큰 — 구 라우트에서만 사용 | 낮 | ⬜ #2 삭제하면 자동 해결 |

---

## 빌드/테스트 명령

```bash
# Type check
npx tsc --noEmit

# Build (이전 측정: 6.9 분, 13/13 페이지 OK)
npm run build

# Lint
npm run lint

# Dev
npm run dev

# Test
npx vitest
```

---

## 컨벤션 / 함정 (실수 자주 했던 것)

1. **Next.js 16 기준** — `params` 는 Promise. `await params` 잊지 말기.
2. **유학 / 요양보호사 양쪽 작업** — nav.ts / 대시보드 / validators.ts 같은 공유 파일 건드릴 때 양쪽 영향 다 확인.
3. **validators.ts 는 append-only** — 기존 스키마 수정하면 회귀 발생.
4. **navigate-back-or-to** 패턴 — 폼 저장 후 `navigateBackOrTo('/path')` 로 이전 화면 복귀.
5. **베트남 이름 (name_vi) 은 ASCII 대문자 강제 변환** — customer 저장 시 자동 처리.
6. **active=false** 는 homepage 에 노출 안 됨 (RLS).
7. **유학 도메인 inbox 상태 편집** — 호버 펜슬 아이콘, 클릭하면 select. 패턴 통일.

---

## 사용자 정보

- email: `kajkaj202@gmail.com`
- 모든 페이지 auth 필수 (공개 signup 금지)

---

## 새 채팅 시작 시 첫 메시지 권장

```
이 문서 (HANDOFF.md) 를 읽고 컨텍스트 잡아줘.
파일 트리 다 읽지 말고, 이 핸드오프 + 작업 지시만 보고 시작.

[여기에 이번 작업할 내용 적기]
```

---

## 작업 끝나면

1. `npx tsc --noEmit` 통과 확인
2. (해당하면) `QC.md` 에 새 섹션 추가하거나 ⬜ 를 ✅ 로 마크
3. 관련 마이그레이션 만들었으면 `supabase/migrations/00NN_xxx.sql` 추가
4. commit 은 사용자가 명시적으로 요청하지 않으면 하지 마.

---

## 빠른 참조 — 자주 쓰는 파일

| 파일 | 용도 |
|---|---|
| `src/lib/nav.ts` | 사이드바 메뉴 |
| `src/lib/validators.ts` | Zod 스키마 모음 |
| `src/lib/supabase/server.ts` | 서버 컴포넌트용 |
| `src/lib/supabase/browser.ts` | 클라이언트용 |
| `src/lib/require-auth.ts` | 페이지 가드 |
| `src/lib/dashboard.ts` | 대시보드 stats |
| `src/lib/customer-status.ts` | 단계 분포 로직 |
| `src/lib/sms-templates.ts` | SMS 템플릿 |
| `src/lib/format.ts` | 날짜/번호 포맷 |
| `QC.md` | 종합 QC 체크리스트 |
| `supabase/migrations/0009_study_abroad_schema.sql` | 유학 도메인 스키마 (수정 중) |
