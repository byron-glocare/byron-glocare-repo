# Glocare Monorepo

글로케어 서비스 전체를 하나의 저장소로 관리합니다. DB는 단일 Supabase(`oczjvsxmlbuicyhheelc`) 공유, 배포는 앱별 Vercel 프로젝트(Production/Preview 티어).

## 구조

```
apps/
  admin/       — 중심 허브 + 직원용 고객관리 (구 glocare_customer_management)
  abroad/      — 유학 공개 홈페이지 (구 glocare_homepage_abroad)
  caregiver/   — 요양보호사 공개 홈페이지 (구 glocare-homepage-caregiver)
packages/      — 공유 코드 (예정: db / ui / validators / email / ai / config)
```

## 개발

```bash
npm install              # 루트에서 1번 (워크스페이스 전체 설치)
npm run dev:admin        # 또는 dev:abroad / dev:caregiver
```

채팅창(Claude Code 세션)은 도메인 작업이면 해당 `apps/<앱>`에서, 여러 앱에 걸친 공유 변경이면 루트에서 엽니다.

## 환경변수

- 로컬: 각 앱의 `.env.local` (dev/prod 값이 동일하므로 공유값 사용)
- 운영: 각 Vercel 프로젝트에 등록 (Root Directory = `apps/<앱>`)
