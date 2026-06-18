# Admin (apps/admin) — 새 Claude Code 세션 인계

이 문서는 **새 Claude Code 채팅** 시작할 때 컨텍스트 빠르게 잡으라고 만든 거.
파일 트리 다 읽지 말고 이 문서 + [`../../WORKFLOW.md`](../../WORKFLOW.md) 만 보고 바로 작업 시작.

---

## 위치 + 작업 흐름

- **레포 위치**: `C:\dev\glocare/` (모노레포 루트). admin 은 `apps/admin/`.
- **권장 cwd**: 채팅창은 `C:\dev\glocare` (루트) 에서 시작. admin 전용 작업이라도 루트가 편함 (여러 앱 동시 수정 자주 발생).
- **작업 흐름**: [`../../WORKFLOW.md`](../../WORKFLOW.md) 통합 가이드 참고.

---

## 프로젝트 한 줄

**Glocare 통합 어드민** — 요양보호사 + 유학생 도메인 CRM.

- Production URL: `https://glocare-admin.vercel.app`
- Vercel 프로젝트 이름: `glocare_admin`
- GitHub 연결: 현재 `byron-glocare/byron-glocare-repo` (옛 standalone). 모노레포 cutover 후에도 같은 레포 + Root Directory = `apps/admin`

---

## ⚠️ 기술 제약 (반드시 지킴)

- **Next.js 16** — 학습한 데이터와 다름. 의심나면 `node_modules/next/dist/docs/` 가이드 먼저 읽기 (AGENTS.md 명시)
- **App Router + Turbopack**
- **Tailwind CSS 4** — design token 기반 (`--primary`, `--coral` 등). admin 은 `--primary`, homepage 만 `--coral` 토큰 있음 (혼동 주의)
- **Supabase** — Auth + DB + RLS
- **공개 signup 금지** — admin 은 모든 페이지 auth 보호
- **NHN SMS** — 이 계정은 LMS 가 아니라 MMS 엔드포인트 사용 (2026-04-23 이슈 해결됨)

---

## 환경/협업 (반드시)

- DB는 단일 라이브 Supabase(`oczjvsxmlbuicyhheelc`) 공유, 코드만 dev/prod 분리. **추가는 안전(active=false 등 노출 게이팅), 삭제만 금지.**
- DB 변경은 **SQL 써주면 운영자가 Supabase SQL 에디터에 붙여넣음** (CLI/db pull/비번 제안 금지).
- 로컬 실행은 **PowerShell 직접**. 검증은 운영자 Chrome(`localhost:3001`) 또는 인증 fetch.
- 자세한 규칙: 레포 `WORKING_WITH_CLAUDE.md` (있으면) 또는 루트 [`README.md`](../../README.md) + [`WORKFLOW.md`](../../WORKFLOW.md).

---

## 디렉토리 구조 핵심

```
apps/admin/
├─ src/
│  ├─ app/
│  │  ├─ (app)/                    ← auth 보호 그룹
│  │  │  ├─ layout.tsx             ← 사이드바 (요양보호사 / 유학생 그룹)
│  │  │  ├─ page.tsx               ← 대시보드 (양쪽 도메인 stats)
│  │  │  ├─ customers/             ← 요양보호사 교육생
│  │  │  ├─ training-centers/
│  │  │  ├─ care-homes/
│  │  │  ├─ consultations/
│  │  │  ├─ settlements/
│  │  │  ├─ sms/
│  │  │  ├─ settings/
│  │  │  ├─ universities/          ← 유학 도메인 시작
│  │  │  ├─ departments/
│  │  │  ├─ study-centers/
│  │  │  ├─ study-cases/           ← 사례 (TikTok 영상 포함)
│  │  │  ├─ study-channels/        ← SNS 채널
│  │  │  ├─ students/              ← 유학생 inbox (상담/보험 탭)
│  │  │  └─ admissions/            ← 입학서류 통합 (2026-06 추가)
│  │  ├─ api/
│  │  └─ login/
│  ├─ lib/
│  │  ├─ nav.ts                    ← 사이드바 메뉴 정의
│  │  ├─ validators.ts             ← Zod 스키마 (append-only 로 관리)
│  │  ├─ supabase/                 ← server/browser client
│  │  ├─ require-auth.ts           ← 페이지 가드
│  │  └─ ... (도메인 별 로직)
│  └─ components/
└─ supabase/
   └─ migrations/                  ← 0001 ~ 현재 (계속 증가)
```

---

## 환경변수 (Vercel)

**프로젝트**: `glocare_admin`

| key | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side 작업용 |
| `RESEND_API_KEY` | 이메일 발송 |
| `RESEND_FROM_EMAIL` | help@glocare.co.kr |
| `RESEND_NOTIFY_EMAIL` | kajkaj202@gmail.com |
| NHN SMS 관련 키들 | (MMS 엔드포인트 사용) |

⚠️ admin 환경변수와 caregiver / abroad 홈페이지 환경변수는 Vercel 프로젝트가 각각 다름 (이전에 헷갈려서 잘못 넣은 적 있음).

---

## 추출 기능 환경 (admissions)

- 모집요강/Flow B의 AI 추출은 abroad 앱 (`apps/abroad`) 의 `/api/admission/extract` 를 호출.
- `.env.local`의 `EXTRACTION_API_URL=http://127.0.0.1:3000/api/admission/extract` (abroad 로컬 3000).
- **추출 테스트하려면 abroad 와 admin 둘 다 dev 서버 띄워야 함**:
  - admin: `npm run dev:admin` (port 3001)
  - abroad: `npm run dev:abroad` (port 3000)
- 운영 `youstudyinkorea.com/api/admission/extract` 가 prod 에 안 떴으면 로컬 abroad 서버 필요. (cutover 후엔 모노레포 통합 빌드라 자동 해결될 수도)

---

## 디자인 토큰 주의

| 토큰 | admin | homepage(abroad/caregiver) |
|---|---|---|
| `--primary` (#ff6060) | ✅ | ✅ |
| `--coral` | ❌ 없음 | ✅ |

**bg-coral 을 admin 에 쓰면 무색**. `bg-primary` 사용.

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
  - 유학 홈페이지 상담 신청 → `apps/abroad/.../api/...` (study_contacts insert)
  - 유학 홈페이지 제휴 신청 → 같은 endpoint, recruiting='partner'
  - 보험 환급 → study_insurance_claims

---

## 빌드/테스트 명령

```bash
# admin 폴더에서 (또는 루트에서 -w admin 옵션)
npx tsc --noEmit          # type check
npm run build             # build (이전: 약 7분, 13/13 페이지 OK)
npm run lint              # lint
npm run dev               # dev (port 3000, 루트에서 dev:admin 쓰면 3001)
npx vitest run            # test
```

---

## 컨벤션 / 함정 (실수 자주 했던 것)

1. **Next.js 16 기준** — `params` 는 Promise. `await params` 잊지 말기.
2. **유학 / 요양보호사 양쪽 작업** — nav.ts / 대시보드 / validators.ts 같은 공유 파일 건드릴 때 양쪽 영향 다 확인.
3. **validators.ts 는 append-only** — 기존 스키마 수정하면 회귀 발생.
4. **navigate-back-or-to** 패턴 — 폼 저장 후 `navigateBackOrTo('/path')` 로 이전 화면 복귀.
5. **베트남 이름 (name_vi) 은 ASCII 대문자 강제 변환** — customer 저장 시 자동 처리.
6. **active=false** 는 homepage 에 노출 안 됨 (RLS).

---

## 사용자 정보

- email: `kajkaj202@gmail.com`
- 모든 페이지 auth 필수 (공개 signup 금지)

---

## 새 채팅 시작 시 첫 메시지 권장

```
[작업 지시]

(필요 시 추가:) 이 문서 (apps/admin/HANDOFF.md) 와 ../../WORKFLOW.md 도 봐줘.
```

---

## 작업 끝나면 (WORKFLOW.md 와 동일)

1. `npx tsc --noEmit` 통과 확인
2. `npx vitest run` 통과 확인
3. 관련 마이그레이션 만들었으면 `supabase/migrations/00NN_xxx.sql` 추가 + 사용자에게 SQL 알림
4. commit 은 자동 (사용자 글로벌 규칙). prod 까지 가야 하면 [[prod_sync_clone]] 흐름.

---

## 📋 다음 채팅 우선순위 작업 (2026-06-16 정리)

### 🔥 묶음 B — 큰 작업, fresh 컨텍스트로 시작 권장

#### B-1: 교육생 상세 탭 시스템 폐기 → "한눈에 보기" 단일 화면 통합

**현재**: `/customers/[id]` 가 4개 탭 (기본정보 / 진행단계 / 상담 / 정산) + 5번째 모아보기 (한눈에 보기) 탭

**변경**:
- 4개 탭 모두 제거, "한눈에 보기" 만 남김 (탭바 자체 제거)
- 모아보기 전용 저장 버튼 제거
- 다른 탭에서 쓰던 [저장 / 삭제 / 취소] 세트로 통일 (한 곳에 한 세트만)

**영향 파일** (확인 필요):
- `apps/admin/src/components/customer-edit-tabs.tsx` — 탭 컨테이너
- `apps/admin/src/components/customer-basic-form.tsx`
- `apps/admin/src/components/customer-progress-tab.tsx`
- `apps/admin/src/components/customer-consultations-tab.tsx`
- `apps/admin/src/components/customer-settlement-tab.tsx`
- `apps/admin/src/components/customer-overview-tab.tsx` (= 한눈에 보기)
- `apps/admin/src/app/(app)/customers/[id]/page.tsx` — 페이지

**회귀 risk 큼** — 각 탭의 server action / state / form 패턴 일치하는지 분석 후 통합. 단순 코드 복붙 아님.

#### B-2: "요양보호" 모든 메뉴의 저장/삭제/취소 버튼 위치 → 최하단

**의미**: 사이드바 "요양보호사" 그룹의 모든 페이지 (교육생/교육원/요양원/상담/정산/알림발송/설정/대시보드?) 의 폼 페이지에서 [저장·삭제·취소] 세트 버튼이 중간에 있는 경우 → 최하단으로 일관 이동.

**접근**:
1. 먼저 사이드바 nav.ts 의 "요양보호사" 그룹 확인 → 대상 페이지 list-up
2. 각 페이지의 button 위치 확인 (이미 최하단이면 skip)
3. 패턴 통일

광범위 변경. 한 페이지씩 하면서 사용자 검증 받기 권장.

---

### 🟢 묶음 A — 다음 채팅에서 *먼저* 처리할 작은-중간 작업

#### A-1: 정산 메뉴에 "예약금 조회" 탭 추가
- 4번째 탭 추가 (현재 정산예정/완료내역/교육생별정산)
- 교육예약금 (reservation_payments) + 웰컴팩 예약금 (welcome_pack_payments) 통합 시간순
- 타입 컬럼으로 구분 ("교육" / "웰컴팩")
- 기존 표 스타일 그대로

#### A-2: 알림 발송 → 신규 교육생 — 검색 + 카드 default 닫힘
- `apps/admin/src/components/sms-new-student-view.tsx` 또는 `apps/admin/src/app/(app)/sms/new-student/page.tsx`
- 상단에 교육원 검색창 추가
- 교육원 카드 default 닫힘 (지금은 다 open) → 정산 예정 카드처럼 expand/collapse

#### A-3: 웰컴팩 결제 — 회차 추가 + 메모
- `apps/admin/src/components/customer-settlement-tab.tsx` 의 `WelcomePackPaymentCard`
- 현재 예약/중도/잔금 3분할 고정
- 변경: 추가 버튼으로 4,5회차 동적 추가 (DB 컬럼 추가 필요할 수도 — 마이그레이션)
- 메모 필드 추가 (welcome_pack_payments 에 `notes` 컬럼)

---

## 📁 작업 환경 빠른 참조

- **현재 작업 위치**: `C:\dev\glocare\apps\admin` (모노레포)
- **prod sync push 채널**: `C:\dev\repos\admin-prod` (별도 clone — [[prod_sync_clone]])
- **빌드/테스트**: `cd C:\dev\glocare\apps\admin && npx tsc --noEmit && npx vitest run`

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
| `src/lib/commission.ts` | 소개비 정산 로직 |
| `src/lib/sms-templates.ts` | SMS 템플릿 |
| `src/lib/format.ts` | 날짜/번호 포맷 |
| `supabase/migrations/` | DB 스키마 변경 이력 |
