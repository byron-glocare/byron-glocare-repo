# Glocare Monorepo — 작업 흐름 통합 가이드

**모든 채팅창에서 동일하게 따를 작업 흐름.** 이 문서는 사용자가 어느 채팅창에서 어떤 작업을 시켜도 같은 결과가 나오게 하는 데 목적이 있음.

---

## 1. 채팅창 시작

| 조건 | cwd |
|---|---|
| 기본 (거의 모든 작업) | `C:\dev\glocare` |
| 한 앱 전용 작업이라도 | `C:\dev\glocare` 권장 (모든 앱 동시 수정 가능) |

```powershell
cd C:\dev\glocare
claude
# 또는
claude remote-control --name "Glocare"
```

> ⚠️ OneDrive 의 옛 worktree (`...Desktop\glocare_customer_management\...`) 는 **사용 금지**. 백업용으로만 유지. 자세한 이유: [memory `dev_onedrive_slow_fs`](#).

---

## 2. 작업 시작 시 컨텍스트 잡기

새 채팅에서 작업 시작할 때 *읽어야 할 문서*:

| 작업 종류 | 읽기 권장 |
|---|---|
| admin (요양보호사/유학생 CRM, 대시보드, settlements 등) | [`apps/admin/HANDOFF.md`](./apps/admin/HANDOFF.md) |
| abroad (유학 공개 홈페이지) | [`apps/abroad/HANDOFF.md`](./apps/abroad/HANDOFF.md) + [`apps/abroad/PLAN_B.md`](./apps/abroad/PLAN_B.md) |
| caregiver | (HANDOFF 작성 예정) |
| 모노레포 자체 / 공유 코드 / 배포 | 이 문서 + [`README.md`](./README.md) |
| prod cutover 결단 시 | [`DEPLOYMENT_CUTOVER.md`](./DEPLOYMENT_CUTOVER.md) |

---

## 3. 개발 / 검증 / commit / push

### 코드 수정
- 직접 `apps/<앱>/src/...` 파일 편집
- 여러 앱 동시 수정 OK (모노레포의 핵심 장점)

### dev 서버
```powershell
cd C:\dev\glocare
npm run dev:admin       # 3001
npm run dev:abroad      # 3000
npm run dev:caregiver   # 3002
```

### 검증
```powershell
cd C:\dev\glocare\apps\<앱>
npx tsc --noEmit        # type check
npx vitest run          # tests
```

### Git
- monorepo 의 git: `C:\dev\glocare\.git` (단일)
- remote: `byron-glocare-repo` (origin)
- **branch 정책**:
  - `main` = prod source (옛 standalone admin 코드 — cutover 전까지 안 건드림)
  - `monorepo` = 모노레포 작업 history (cutover 시점에 main 으로 force-merge)
  - `legacy/standalone-admin` = 옛 main 백업 (cutover 전 보존용)
  - 작업 brunch 는 자유

### Commit
- 사용자 글로벌 규칙: **local commit 자동** (사용자가 매번 묻지 않아도 됨)
- 단 commit 메시지는 작업 내용 정확히
- 다른 채팅창 작업과 충돌 방지: `git add <files>` 로 *내가 수정한 파일만* 명시. `git add -A` 금지

### Push
- **push 는 사용자 명시 요청 시에만** (글로벌 규칙)
- monorepo 의 git 은 cutover 전까지 push 흐름이 미정 → push 명령 받으면 사용자에게 어디로 push 할지 확인:
  - 일반 작업 commit → `git push origin <branch>` (어떤 브랜치든 main 제외)
  - cutover 가야 prod 자동 배포

---

## 4. prod 배포 상태 (2026-06-15 현재)

### 현재 (cutover 전)
- **monorepo 의 어떤 commit 도 push 만으로는 prod 안 감** (monorepo 의 main 으로 push 가 안 됨, 별도 브랜치는 Vercel preview 만)
- prod 배포 흐름: 옛 standalone GitHub 레포 (`byron-glocare-repo` / `glocare-homepage-abroad` / `glocare-homepage-caregiver`) 의 main 으로 push 시 → Vercel 자동 prod 배포

### cutover 후 (사용자가 결단할 때)
- **monorepo `main` 브랜치로 push 시 → Vercel 자동 prod 배포 (3개 앱 모두)**
- 자세한 cutover 절차: [`DEPLOYMENT_CUTOVER.md`](./DEPLOYMENT_CUTOVER.md)

### 그럼 지금은 어떻게 prod 가나?
- 사용자가 "이 작업을 prod 보내자" 명시 시:
  - **admin** 변경 → 사용자가 작업 위치를 옛 standalone repo (또는 그 worktree) 로 옮겨서 다시 작업 + push, 또는 cutover 결단
  - **abroad / caregiver** 변경 → 동일
- 즉 **cutover 전까지는 모노레포 작업이 자연스럽게 prod 안 감** (이게 의도된 hold)
- 사용자가 prod 가야 한다고 결단하면 → [`DEPLOYMENT_CUTOVER.md`](./DEPLOYMENT_CUTOVER.md) 진행

---

## 5. DB 작업 (Supabase)

- DB: 단일 라이브 Supabase `oczjvsxmlbuicyhheelc` 공유 (dev/prod 동일)
- 마이그레이션 위치: `apps/admin/supabase/migrations/00NN_xxx.sql`
- **append-only** — 기존 파일 수정 금지, 새 번호로 추가만
- 추가는 안전 (active=false 등 노출 게이팅 패턴), **삭제만 금지**
- 적용 방법: SQL 파일 사용자에게 보여주면 사용자가 Supabase SQL 에디터에 붙여넣음 (CLI/db pull/비번 제안 금지)

---

## 6. 동시 작업 주의

- 사용자가 동시에 여러 채팅창에서 작업할 수 있음
- 같은 파일 동시 수정 충돌 가능 — `git add <files>` 명시로 broad staging 방지
- monorepo `.git/index.lock` 발견 시 (다른 채팅창 git 작업 중) 잠시 대기 후 재시도

---

## 7. 사용자에게 보고할 때

- 매 작업 끝나면 *prod 까지 갔는지* 명확히 표시:
  - "코드 변경 완료, monorepo 에 commit. **prod 안 감** (cutover 전이라)"
  - "옛 standalone repo 로 sync push 했으니 Vercel 자동 배포될 것"
- 사용자가 검증해야 할 게 있으면 명시 (URL, SQL 적용 등)

---

## 8. 자주 쓰는 명령 (cheat sheet)

```powershell
# dev 서버
cd C:\dev\glocare && npm run dev:admin

# typecheck + tests (한 앱)
cd C:\dev\glocare\apps\admin && npx tsc --noEmit && npx vitest run

# 한 앱만 빌드
cd C:\dev\glocare && npm run build:admin

# git status (monorepo 전체)
cd C:\dev\glocare && git status --short

# 우리 변경만 add + commit
cd C:\dev\glocare && git add apps/admin/src/<file> && git commit -m "..."
```
