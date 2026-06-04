# Glocare — 외국인 요양보호사 홈페이지

베트남 요양보호사 교육생 대상 홈페이지. 유학 사이트와 분리된 별도 프로젝트.

## 구조

- **메인** (`/`) — 기능 카드 + KPI
- **글로케어 소개** (`/about`) — 회사 역할 + CEO + 교육신청/제휴문의 모달
- **동영상 교육** (`/videos`) — Vimeo 영상 + 시청 여부 — 멤버십 (`교육` / `교육+웰컴팩`)
- **CBT 문제풀이** (`/cbt`) — 1721 문제 중 30 랜덤 — 멤버십
- **파트너스** (`/partners`) — 요양원·교육원·대학교 (지도 + 카드)
- **엠버서더** (`/ambassador`) — 입장코드 + 카톡방 QR
- **이력서 만들기** (`/resume`) — AI 정리 → PDF — 멤버십 (`웰컴팩` / `교육+웰컴팩`)
- **내 정보** (`/profile`) — 프로필 + 문의 + 로그아웃
- **로그인** (`/login`) — Google + Facebook
- **약관** (`/terms`, `/privacy`) — 표준 템플릿

## 기술 스택

- Next.js 16 (App Router, Turbopack)
- Tailwind 4
- Supabase (admin/유학 사이트와 동일 프로젝트)
- Resend (이메일)
- Anthropic Claude (이력서 AI)
- @react-pdf/renderer (PDF 생성)

## 데이터

- `customers` 테이블 (admin 과 공유) — `auth_user_id` 컬럼 추가됨
- 신규 테이블: `videos`, `video_views`, `cbt_questions`, `cbt_attempts`, `resumes`, `ambassador_config`, `caregiver_contacts`
- Storage 버킷: `resume-photos`, `resume-pdfs`

## 환경변수

`.env.example` 참고.

## 개발

```
npm install
cp .env.example .env.local  # 값 채우기
npm run dev
```
