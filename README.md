# Glocare Homepage — Abroad (유학)

[youstudyinkorea.com](https://youstudyinkorea.com) 의 신규 Next.js 16 + Supabase 버전.

## Stack
- Next.js 16 (App Router, Turbopack)
- Tailwind CSS 4
- Supabase (anon key, RLS 정책으로 익명 read/insert 제한)
- Resend (이메일 알림)
- 한/베 i18n (cookie 기반)

## 개발

```bash
npm install
cp .env.example .env.local  # 값 채우기
npm run dev
```

## 환경변수

| Key | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | admin 프로젝트와 동일 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | admin 프로젝트와 동일 |
| `RESEND_API_KEY` | Resend dashboard 에서 발급 |
| `RESEND_FROM_EMAIL` | 발송지 (예: `help@glocare.co.kr`) |
| `RESEND_NOTIFY_EMAIL` | 운영자 알림 받을 이메일 |

## 페이지

| Route | 설명 |
|---|---|
| `/` | 홈 (대학·사례·센터 요약) |
| `/about` | 소개 + SNS 채널 |
| `/universities` | 대학 목록 |
| `/universities/[id]` | 대학 상세 + 학과 |
| `/cases` | 취업 사례 |
| `/centers` | 베트남 협력 유학 센터 |
| `/apply` | 상담 신청 폼 |
| `/insurance` | 보험 신청 폼 |

## 데이터

같은 Supabase 프로젝트 (admin 과 공유). 7개 테이블:
- `universities`, `departments`
- `study_centers`, `study_cases`, `study_channels`
- `study_contacts` (상담 폼 inbox)
- `study_insurance_claims` (보험 폼 inbox)

마이그레이션은 admin repo 의 `supabase/migrations/0009_*.sql` 참조.

## 배포

Vercel 신규 프로젝트로 분리 배포. admin 프로젝트와 같은 Supabase 사용.
