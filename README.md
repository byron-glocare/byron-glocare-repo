# Glocare Monorepo

글로케어 서비스 전체를 하나의 저장소로 관리합니다.

- **DB**: 단일 Supabase(`oczjvsxmlbuicyhheelc`) 공유 (dev/prod 동일)
- **GitHub** (예정 통합): `byron-glocare/byron-glocare-repo` 1곳으로 통합 (옛 abroad/caregiver 레포는 archive 예정)
- **배포**: 앱별 Vercel 프로젝트, Root Directory = `apps/<앱>`

> ⚠️ 2026-06-15 현재 — 모노레포 통합은 **로컬 코드 + 백업 브랜치(`legacy/standalone-admin`) 까지만 완료**. GitHub main / Vercel 의 Root Directory 전환은 운영자가 "이제 prod 가자" 결단할 때 일괄 실행. 자세한 절차는 [`DEPLOYMENT_CUTOVER.md`](./DEPLOYMENT_CUTOVER.md) 참고.

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
npm run dev:admin        # port 3001 (또는 dev:abroad 3000 / dev:caregiver 3002)
```

## Claude Code 채팅창 시작 위치

| 작업 범위 | 채팅창 cwd |
|---|---|
| 여러 앱에 걸친 변경 (DB 스키마, 공유 컴포넌트 등) — 가장 흔함 | `C:\dev\glocare` (루트) |
| 한 앱에 한정된 작업 (어차피 루트에서 해도 됨) | `C:\dev\glocare` (루트) 권장 |

→ **사실상 항상 루트에서 시작 권장**. 채팅창 1개로 admin/abroad/caregiver 모두 수정 가능.

## 작업 흐름

[`WORKFLOW.md`](./WORKFLOW.md) 참고 — 어느 채팅창에서든 동일하게 따를 통합 가이드.

## 환경변수

- 로컬: 각 앱의 `.env.local` (dev/prod 값이 동일하므로 공유값 사용)
- 운영: 각 Vercel 프로젝트에 등록 (Root Directory = `apps/<앱>`)

## Vercel 프로젝트 (현재 상태)

| Vercel 프로젝트 | URL | 현재 GitHub 연결 | cutover 후 GitHub 연결 |
|---|---|---|---|
| glocare_admin | glocare-admin.vercel.app | `byron-glocare/byron-glocare-repo` (옛 standalone main) | 동일 + Root Directory = `apps/admin` |
| glocare-homepage-abroad | glocare-homepage-abroad.vercel.app | `byron-glocare/glocare-homepage-abroad` | `byron-glocare/byron-glocare-repo` + Root Directory = `apps/abroad` |
| glocare-homepage-caregiver | glocare-homepage-caregiver.vercel.app | `byron-glocare/glocare-homepage-caregiver` | `byron-glocare/byron-glocare-repo` + Root Directory = `apps/caregiver` |
