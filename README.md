# Glocare 교육생 관리 시스템

베트남 요양보호사 교육생 매칭 / 취업 / 정산 통합 관리 어드민.

## 기술 스택

- **Frontend**: Next.js 16 (App Router) + TypeScript + React 19
- **UI**: Tailwind CSS v4 + shadcn/ui (base-nova) + lucide-react
- **Font**: Pretendard Variable
- **Backend / DB**: Supabase (Postgres + Auth + Realtime)
- **Form**: React Hook Form + Zod
- **SMS**: NHN Cloud Notification > SMS
- **Translation**: Google Cloud Translation API
- **배포**: Vercel

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example` 파일을 `.env.local` 로 복사한 뒤 값 채우기.

```bash
cp .env.local.example .env.local
```

필요한 키:

| 변수 | 출처 | 사용 시점 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard > Settings > API | Phase 2~ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 동일 | Phase 2~ |
| `SUPABASE_SERVICE_ROLE_KEY` | 동일 (⚠ 클라이언트 노출 금지) | Phase 8 (계정 관리) |
| `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Console > 사용자 인증 정보 | Phase 5-7 (번역) |
| `NHN_SMS_APP_KEY` | NHN Cloud > SMS > URL & Appkey | Phase 7-3 |
| `NHN_SMS_SECRET_KEY` | 동일 | Phase 7-3 |
| `NHN_SMS_SEND_NO` | 발신번호 등록 후 (KISA 사전등록 필요) | Phase 7-3 |

### 3. 개발 서버 실행

```bash
npm run dev
```

→ http://localhost:3000

### 4. 빌드 & 배포

```bash
npm run build
npm start
```

Vercel 배포는 GitHub 레포 연결 후 자동.

## 디렉터리 구조

```
glocare_customer_management/
├── public/                 정적 자산 (logo 등)
├── src/
│   ├── app/                Next.js App Router (페이지/레이아웃/route handlers)
│   ├── components/
│   │   └── ui/             shadcn/ui 컴포넌트
│   └── lib/                유틸 (utils, supabase client 등)
├── supabase/               (Phase 3 이후) 마이그레이션 SQL, seed 스크립트
├── docs/                   (Phase 13) admin-guide, schema 등 산출 문서
├── 개발지시서.md           제품 사양 (v1.2)
└── .env.local.example      환경 변수 템플릿
```

## 디자인 시스템

| 토큰 | 값 |
|---|---|
| Brand Primary | `#FF6060` |
| Brand Hover | `#E84545` |
| Background | `#F9FAFB` |
| Card / Surface | `#FFFFFF` |
| Border | `#E5E7EB` |
| Text Primary | `#111827` |
| Text Secondary | `#6B7280` |
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Danger | `#EF4444` |
| Info | `#3B82F6` |

Tailwind 클래스: `bg-primary`, `text-primary`, `bg-brand`, `hover:bg-brand-hover`,
`text-success`, `text-warning`, `text-info`, `bg-destructive` 등.

## 개발 진행 현황

자세한 단계는 [개발지시서.md](./개발지시서.md) §9 참고.

- [x] **Phase 1**: 기반 구축 (Next.js / Tailwind / shadcn / Pretendard / 브랜드 컬러)
- [ ] Phase 2: 인증 & 공통 레이아웃
- [ ] Phase 3: DB 스키마
- [ ] Phase 4: 교육원 / 요양원 CRUD
- [ ] Phase 5: 고객관리 핵심
- [ ] Phase 6: 정산 모듈
- [ ] Phase 7: 알림발송 (SMS)
- [ ] Phase 8: 설정 (상태값/결제/계정)
- [ ] Phase 9: 대시보드
- [ ] Phase 10: 더미데이터 투입
- [ ] Phase 11: QA
- [ ] Phase 12: 엑셀 데이터 마이그레이션
- [ ] Phase 13: 완성

## 보안 원칙

- `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_TRANSLATE_API_KEY`, `NHN_SMS_*` 키는
  **반드시 Next.js API Route (서버 사이드)** 에서만 사용. 클라이언트 코드에 노출 금지.
- 모든 페이지는 `middleware.ts` 로 보호. 미로그인 시 `/login` 으로 리다이렉트.
- `/signup` 같은 공개 회원가입 라우트는 만들지 않음. 계정 생성은 로그인 사용자가
  설정 페이지에서만 가능 (Supabase Auth Admin API).
