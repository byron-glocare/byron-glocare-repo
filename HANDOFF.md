# Glocare 통합 작업 — 인계 문서

**작성**: 2026-04-28 (rate-limit 으로 세션 끊김 → 새 채팅에서 이어가기 위함)

---

## 🎯 전체 그림

`youstudyinkorea.com` (유학 홈페이지) 을 Cloudflare Workers + Google Drive DB 에서 → **Vercel + Supabase** 로 통합 이전. 
Admin 은 기존 `glocare-customer.vercel.app` (Next.js) 안에 흡수.

```
[Supabase 단일 프로젝트]
   - 요양보호사 도메인 (customers, training_centers, ...)
   - 유학 도메인 (universities, departments, study_centers, study_cases,
                   study_contacts, study_channels, study_insurance_claims)
       ▲
       │
   ┌───┴────────────────────────────────┐
   │                                    │
[Vercel A] glocare-customer.vercel.app  [Vercel B] youstudyinkorea.com
   ↑ admin (Next.js, 작동 중)            ↑ glocare_homepage_abroad (작업 중)
```

---

## ✅ 완료 — Phase 1 (admin 측)

- [x] **Supabase 0009 마이그레이션** 실행 (사용자 확인) — 7개 테이블 + RLS
- [x] **데이터 임포트 SQL** 실행 (사용자 확인) — 11 대학·19 학과·5 센터·6 사례·5 상담·2 보험·6 채널
- [x] **사이드바 "유학생" 그룹 활성화** (`/students`, `/universities`, `/study-centers`)
- [x] **admin 읽기 전용 페이지 3개** 배포 (Vercel 자동)

> 다음 admin 작업 (예정): 편집 폼 (universities/centers/cases CRUD), 상담/보험 inbox 상태 변경 UI

---

## 🟡 진행 중 — Phase 2 (홈페이지)

### 폴더
`C:\Users\kajka\OneDrive\Desktop\glocare_homepage_abroad\`  
(GitHub: `byron-glocare/glocare-homepage-abroad`)

### 완료
- [x] Next.js 16 + Tailwind 4 부트스트랩
- [x] Supabase client 설정 (anon)
- [x] i18n 한/베 dictionary
- [x] 8 페이지 라우팅 (`/`, `/about`, `/universities`, `/universities/[id]`, `/cases`, `/centers`, `/apply`, `/insurance`)
- [x] 폼 2개 (apply / insurance) + Resend server actions
- [x] git init + GitHub push
- [x] **Vercel 배포** (사용자 확인)
- [x] 도메인 DNS — 도레지 → Vercel NS 위임 완료 (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`)
- [x] DNS 전파 — Vercel IP `64.29.17.65`, `216.198.79.1` 정상 응답

### 미완료 (= **재개 시 우선**)
1. ⚠️ **디자인 1:1 변환 작업 진행 중**
   - 사용자 피드백: 새로 만든 디자인 ❌, **기존 `glocare_homepage/index.html` 디자인 그대로 살려야 함**
   - 접근법 결정: **Tailwind 정석 변환** (옵션 3)
   - 시작 단계: `globals.css` 에 디자인 토큰 (coral/peach/ink 컬러) + 폰트 변수만 세팅함
   - **다음 작업**:
     - 폰트: Be Vietnam Pro + Noto Sans KR + Noto Serif KR — `next/font/google` 로 추가
     - 레이아웃: `LangBar` (상단 코랄 바) + `Nav` (sticky) + `Footer`
     - 섹션별 변환 (큰 작업):
       - `#hero` (베트남 국기 배지 + 타이틀 + CTA + 영상 섹션)
       - `#cases` (취업 사례 카드)
       - `#universities` (대학 그리드)
       - `#apply` (상담 폼)
       - `#recruiting`
       - `#centers` (베트남 센터)
       - `#insurance-refund`
       - `#insurance-info`
       - 보험 popup
   - 참고 원본:
     - HTML: `C:\Users\kajka\OneDrive\Desktop\glocare_homepage\index.html` (~700KB, 약 1700 라인)
     - HTML: `C:\Users\kajka\OneDrive\Desktop\glocare_homepage\about.html`
     - 디자인 토큰은 글로벌 CSS 변수 (`:root`) 22~46 라인에 있음

2. **이메일 (Resend) 설정 미완료**
   - 사용자가 Resend 가입 + API 키 받았음
   - `glocare.co.kr` 도메인 verify 는 **AWS SES 와 충돌 우려** 로 미완료
   - 임시 옵션: `RESEND_FROM_EMAIL=onboarding@resend.dev` 로 즉시 발송 가능
   - 본격 셋업: Resend 가 보여주는 DNS 레코드 (DKIM 등) 를 도레지 DNS 에 **추가** (기존 AWS 레코드 삭제 X)

3. **(선택) Phase 1 개선 — admin 측 편집 폼**
   - 현재 admin `/universities`, `/study-centers`, `/students` 는 읽기 전용
   - CRUD UI 필요 (뒤에)

---

## 🚀 새 채팅에서 재개하는 방법

새 채팅 시작 후 다음 메시지를 **그대로 붙여넣기**:

```
이어서 작업해줘.

상황: glocare_customer_management 의 admin 통합 + glocare_homepage_abroad 의
홈페이지 신규 프로젝트를 만들고 있었어. rate limit 으로 세션 끊김.

전체 인계 문서:
C:\Users\kajka\OneDrive\Desktop\glocare_homepage_abroad\HANDOFF.md

이걸 먼저 읽고 다음 작업 부터 이어가줘:
1. Be Vietnam Pro + Noto Sans KR 폰트 추가 (next/font)
2. LangBar + Nav + Footer 컴포넌트 작성 (기존 HTML 디자인 1:1)
3. Hero 섹션부터 순서대로 React 컴포넌트로 변환

원본 디자인:
- C:\Users\kajka\OneDrive\Desktop\glocare_homepage\index.html
- C:\Users\kajka\OneDrive\Desktop\glocare_homepage\about.html

새로 만든 (버려질) 디자인:
- C:\Users\kajka\OneDrive\Desktop\glocare_homepage_abroad\src\app\page.tsx 등
  → 기존 HTML 디자인으로 갈아엎을 것

Supabase 데이터 모델은 admin 프로젝트 supabase/migrations/0009_* 참고.
타입은 src/types/database.ts.

관련 사용자 결정 사항:
- 새 디자인 X, 기존 디자인 1:1 (Tailwind 정석 변환)
- 다국어 한/베, cookie 'locale' 기반
- 폼 → Supabase + Resend (운영자 알림 + 고객 confirmation)
- 운영자 알림 받을 메일: kajkaj202@gmail.com
- 발송지: help@glocare.co.kr (도메인 verify 안 되면 onboarding@resend.dev 로 임시)
```

---

## 📁 핵심 파일 위치

### admin 프로젝트
```
C:\Users\kajka\OneDrive\Desktop\glocare_customer_management\
  src/app/(app)/                  — admin 페이지
    customers/                    — 교육생 (요양보호사)
    training-centers/             — 교육원
    care-homes/                   — 요양원
    students/                     — 유학생 inbox (신규)
    universities/                 — 대학교 (신규)
    study-centers/                — 유학센터 (신규)
    settlements/, sms/, settings/
  src/components/                 — 공용 컴포넌트
  src/lib/                        — 유틸/스키마
  src/types/database.ts           — Supabase 전체 타입 (요양·유학 모두)
  supabase/migrations/
    0001~0009_*.sql               — 전체 마이그레이션 history
  scripts/
    import_excel.py               — 요양보호사 엑셀 임포트
    import_glocare_db.py          — 유학 엑셀 임포트
    output/                       — 생성된 SQL (gitignore)
```

### homepage 프로젝트 (이번 작업)
```
C:\Users\kajka\OneDrive\Desktop\glocare_homepage_abroad\
  src/app/
    layout.tsx                    — Geist 폰트 (변경 필요 → Be Vietnam Pro)
    page.tsx                      — 새 디자인 (버려질 것)
    about/, universities/, etc.   — 8개 페이지
    actions/
      contacts.ts                 — 폼 server actions (Supabase + Resend)
      locale.ts                   — locale cookie 토글
  src/components/
    site-header.tsx               — 새 디자인 (버려질 것)
    site-footer.tsx               — 새 디자인 (버려질 것)
    contact-form.tsx              — 폼 (디자인 갈아엎을 것)
    insurance-form.tsx            — 폼 (디자인 갈아엎을 것)
    locale-switch.tsx             — 한/베 토글
  src/lib/
    supabase/                     — server.ts + client.ts
    i18n.ts                       — 한/베 dictionary
    email.ts                      — Resend 발송
    utils.ts                      — cn() helper
  src/types/database.ts           — admin 과 동일 (수동 동기화)
  HANDOFF.md                      — 이 문서
  README.md                       — 프로젝트 설명
  .env.example                    — 환경변수 샘플
```

### 원본 (참고용)
```
C:\Users\kajka\OneDrive\Desktop\glocare_homepage\
  index.html        — 약 700KB. 라인 22-1149: <style>. 라인 1150+: <body>
  about.html        — 약 565KB
  admin.html        — 약 80KB (기존 admin)
  worker/           — Cloudflare Workers 코드 (버릴 것)
  dist/             — 빌드 산출물
```

---

## 🔐 환경변수 (양쪽 Vercel 프로젝트 공통)

| Key | 값 출처 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 위치 |
| `SUPABASE_SERVICE_ROLE_KEY` | **admin 만** (계정 관리용) |
| `ANTHROPIC_API_KEY` | **admin 만** (상담 분석) |
| `GOOGLE_TRANSLATE_API_KEY` | **admin 만** (베트남어 번역) |
| `NHN_SMS_*` | **admin 만** (SMS) |
| `RESEND_API_KEY` | **homepage 만** (이메일 알림) |
| `RESEND_FROM_EMAIL` | **homepage 만** (`onboarding@resend.dev` 임시) |
| `RESEND_NOTIFY_EMAIL` | **homepage 만** (`kajkaj202@gmail.com`) |

---

## 📝 Git 상태

### admin (`glocare_customer_management`)
- 브랜치: `main` (최신)
- worktree: `.claude/worktrees/bold-jang-c888c9` (최근 커밋들 다 머지됨)
- 최근 commit: `7b6c9de` (`feat(study-abroad): 유학 도메인 스키마 + admin 페이지 3개`)

### homepage (`glocare_homepage_abroad`)
- 브랜치: `main`
- 1차 commit 완료: `chore: initial Next.js 16 setup for youstudyinkorea.com`
- GitHub push 완료
- Vercel 배포 완료 (자동)
- 다음 commit 은 디자인 갈아엎기

---

## ⚠️ 알려진 이슈

1. **로컬 DNS 캐시** — `youstudyinkorea.com` 이 로컬 PC 에서 `DNS_PROBE_FINISHED_NXDOMAIN` 으로 안 풀림. 글로벌 DNS (Google 8.8.8.8) 는 정상. 시간 지나면 풀림.
2. **Resend 도메인 verify 미완료** — AWS SES 와 같은 도메인이라 사용자가 신중함. 임시 onboarding 도메인으로 진행 예정.
3. **새 디자인 (현재 페이지)** — 버려질 예정. 기존 `glocare_homepage/index.html` 의 디자인 (`coral` 컬러 베이스, Vietnam Pro 폰트) 으로 1:1 변환 필요.

---

## 🎨 새 채팅에서 첫 작업 (구체)

```bash
# 1. 워크트리/메인 디렉토리 둘 다 사용 가능. 홈페이지 작업은 메인에서:
cd C:\Users\kajka\OneDrive\Desktop\glocare_homepage_abroad

# 2. 디자인 토큰 + 폰트 셋업
#    src/app/layout.tsx 에 next/font 추가:
#      Be_Vietnam_Pro, Noto_Sans_KR, Noto_Serif_KR
#    globals.css 의 --font-be-vietnam, --font-noto-kr 매칭

# 3. 컴포넌트 변환 순서:
#    a. src/components/lang-bar.tsx (코랄 배경 상단 바)
#    b. src/components/site-nav.tsx (sticky nav)  
#    c. src/components/site-footer.tsx
#    d. src/app/page.tsx — 모든 섹션 새 디자인으로
#    e. src/app/apply/page.tsx + components/contact-form.tsx — 디자인 1:1
#    f. 다른 페이지들

# 4. 검증
npx tsc --noEmit
npm run build

# 5. commit + push
git add -A
git commit -m "feat: design 1:1 conversion from glocare_homepage/index.html"
git push origin main
# Vercel 자동 배포

# 6. youstudyinkorea.com 접속해서 확인
```

---

**끝.** 새 채팅에서 위 "재개 방법" 메시지 붙여넣기 + HANDOFF.md 읽으면 이어서 진행 가능.
