# B1-2 / 외부 어드민 — 라우트·인증·i18n 설계

작성: 2026-05-26 · ✅ **구현 완료 2026-05-27** · 출처: PLAN_B.md §6, §10, Decision Log #5·#9 · 관련: [B1_schema.sql](./B1_schema.sql) · [B1_qa_checklist.md](./B1_qa_checklist.md)

> **외부 어드민** = 유학센터 담당자용. 베트남어 디폴트. 공개 사이트와 같은 저장소·같은 Vercel 배포 안에 라우트 분리로 공존.
>
> **Next 16 변경 사항 (구현 시 발견)**:
> - `middleware.ts` → **`proxy.ts`** (Next 16 명칭 변경, 기능 동일). [docs/01-app/01-getting-started/16-proxy.md](../../node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md)
> - 인증의 1차 방어선은 proxy 의 optimistic 쿠키 체크. 실제 검증은 **DAL (Data Access Layer) 패턴** — React `cache()` 처리된 `verifyCenterSession()`. [docs/01-app/02-guides/authentication.md](../../node_modules/next/dist/docs/01-app/02-guides/authentication.md)
> - chrome 분리는 **route group `(site)` / `center/(authed)`** 로 정석 처리 (`src/app/(site)/layout.tsx` vs `src/app/center/layout.tsx`).

---

## 1. 라우트 구조

```
src/app/
├─ layout.tsx                    # 기존 — 공개 사이트(베트남어/한국어 토글)
├─ page.tsx                      # 기존 — 랜딩
├─ apply/ insurance/ universities/ centers/ cases/ about/   # 기존 공개 페이지
├─ actions/                      # 기존 — Server Actions
│
├─ center/                       # 신규 — 외부 어드민 루트
│  ├─ layout.tsx                 # 인증 게이트 + CenterHeader/Sidebar + 베트남어 디폴트
│  ├─ login/page.tsx             # 비인증 진입점
│  ├─ (authed)/                  # 라우트 그룹 — 인증 필수
│  │  ├─ layout.tsx              # org 컨텍스트 로드, 미가입 시 redirect
│  │  ├─ page.tsx                # 대시보드 (마감 임박·검토 대기 학생)
│  │  ├─ students/
│  │  │  ├─ page.tsx             # 학생 목록 + 검색·필터
│  │  │  ├─ new/page.tsx         # 개별 등록
│  │  │  ├─ import/page.tsx      # 엑셀 일괄 업로드  ← B1-3
│  │  │  └─ [id]/
│  │  │     ├─ page.tsx          # 학생 상세
│  │  │     └─ applications/[appId]/page.tsx
│  │  ├─ admissions/page.tsx     # 모집요강 조회 (read-only, 검색)
│  │  ├─ settings/
│  │  │  ├─ profile/page.tsx
│  │  │  └─ users/page.tsx       # org admin 만 (담당자 초대·권한)
│  │  └─ help/page.tsx
│  └─ actions/                   # Server Actions (학생 등록·서류 업로드 등)
│
└─ api/
   └─ center/...                 # 필요 시 Route Handlers
```

**원칙**
- 공개 사이트(`/`, `/apply` 등) 와 외부 어드민(`/center/*`) 은 **완전히 분리된 layout 트리**. 헤더·푸터·디자인 시스템 별개.
- `/center/login` 만 비인증, 그 외 `/center/(authed)/*` 는 모두 인증 필요.
- 라우트 그룹 `(authed)` 로 인증 게이트 layout 을 한 번만 정의 → 하위 모든 페이지에 적용.

---

## 2. 인증 경계

### 2.1 Supabase Auth
- `auth.users` 공유, `study_center_users.auth_user_id` 로 매핑
- 가입은 **초대 기반** (B1 범위): 글로케어 운영팀이 내부 어드민에서 org 와 유저 row 생성 → 초대 메일 발송 → 유저는 패스워드 설정 후 로그인
- self-signup 차단 (공개 사이트의 익명 폼과 다른 경계)

### 2.2 새 파일: `src/proxy.ts` (Next 16 의 `middleware.ts` 후속)
> Next 16 에서 `middleware.ts` 가 `proxy.ts` 로 이름 변경. 기능 동일. 본 설계의 책임 범위는 그대로 적용.

책임:
1. `/center/*` 요청 시 Supabase 세션 쿠키 확인
2. 미인증 + `/center/login` 외 → `/center/login` 으로 redirect
3. 인증되어 있으나 `study_center_users` 행 없음 / status≠active → `/center/login?error=no_access`
4. 그 외 통과
5. `/center/*` 외 라우트는 패스스루 (공개 사이트 영향 X)

`config.matcher` 로 `/center/:path*` 만 매칭.

### 2.3 Supabase 클라이언트 분리
신규 파일:
- `src/lib/supabase/center.ts` — 인증된 server-side 클라이언트 (`createServerClient` 호출 + 세션 쿠키 처리)
- `src/lib/supabase/center-client.ts` — 브라우저용 (`createBrowserClient`)

기존 `src/lib/supabase/server.ts` (익명 anon) 는 공개 사이트 전용으로 유지.

### 2.4 DAL (Data Access Layer) — `src/lib/center/dal.ts`
구현된 함수 (실제 명칭): `verifyCenterSession()` — Next 16 가이드의 DAL 패턴 + React `cache()` 메모이제이션:
```ts
export const verifyCenterSession = cache(async (): Promise<VerifiedCenterSession> => {
  // 1. supabase.auth.getUser()
  // 2. study_center_users join study_center_orgs (RLS 자동)
  // 3. status='active' 확인
  // 4. 셋 다 OK → { authUserId, email, member, org }
  // 5. 어떤 단계든 실패 → redirect('/center/login?error=...')
});
```
모든 `(authed)` layout / page / action 첫 줄에서 호출.
같은 렌더 패스 내 반복 호출은 `cache()` 가 DB 쿼리 1회로 보장.

추가 헬퍼: `getCenterSessionOrNull()` (redirect 없이 optional 조회), `isCenterAdmin(session)` (org 내부 admin 권한 체크).

### 2.5 RLS 와의 관계
- RLS 가 1차 방어선 (B1_schema.sql 의 `study_my_org_ids()`), 미들웨어/세션 헬퍼가 2차 UX 차원
- Server Action 도 인증된 클라이언트를 통해 호출되므로 RLS 자동 적용
- 글로케어 관리자가 외부 어드민에 로그인하면 `study_is_glocare_admin()` 으로 모든 org 가 보일 수 있는데, **운영 정책상 글로케어 관리자는 외부 어드민에 직접 로그인하지 않음** (내부 어드민에서만 작업). 필요 시 외부 어드민 미들웨어에서 `glocare_admin` role 차단 추가

---

## 3. i18n

### 3.1 기존 패턴 그대로 확장
`src/lib/i18n.ts` 에 namespace 추가:
- `center.nav.*` — 사이드바·헤더 메뉴
- `center.dashboard.*` — 대시보드 카드·통계
- `center.students.*` — 학생 목록·등록·상세
- `center.admissions.*` — 모집요강 조회
- `center.settings.*` — 설정
- `center.common.*` — 공통 (저장·취소·확인 등)

기존 `koDict` / `viDict` 두 객체에 키 추가. 외부 어드민에선 **베트남어 표시가 우선**이지만 한국어 키도 함께 작성 (글로케어 운영팀이 외부 어드민 UI 검수 시 한국어로 볼 수 있도록).

### 3.2 디폴트 locale
- 공개 사이트: 현행 — cookie `locale` 없으면 `vi`
- 외부 어드민: **같은 cookie 사용**. cookie 없을 때 `/center/*` 진입이면 `vi` 강제 (현행 default 와 동일하므로 변경 불필요)
- 한국어 토글은 외부 어드민에도 동일하게 표시 (기존 `LocaleSwitch` 컴포넌트 재사용)

### 3.3 Server Action·에러 메시지
폼 검증 메시지·toast·이메일 본문 모두 dict 통해 i18n.
- Server Action 내부에서 `await getLocale()` 호출 후 분기
- zod 스키마의 메시지도 dict 사용

### 3.4 dict 분할 검토 (Out of B1)
현재 i18n.ts 인라인 dict가 외부 어드민 키 추가로 비대해질 가능성. B1 종료 후 namespace 별 파일 분할(`i18n/center.ts`, `i18n/public.ts`) 리팩토링 고려. **B1 에선 일단 한 파일 유지**.

---

## 4. 컴포넌트 / 디자인 시스템

기존 공개 사이트의 디자인 토큰(`tailwind` + globals.css) 재사용, 그러나 레이아웃은 별도:
- `src/components/center/center-header.tsx` — 좌측 로고, 우측 사용자명·org명·로케일 토글·로그아웃
- `src/components/center/center-sidebar.tsx` — 학생·모집요강·설정 메뉴
- `src/components/center/data-table.tsx` — 학생/지원 목록용 (Tailwind + 베트남어 헤더)
- `src/components/center/empty-state.tsx`
- `src/components/center/page-header.tsx`

폰트는 root layout 의 `Be_Vietnam_Pro` 가 그대로 적용됨 (베트남어 가독성 우선).

---

## 5. 권한 모델 (Decision #1 보충)

| Role | 영역 | 능력 |
|---|---|---|
| `glocare_admin` (auth.users.app_metadata.role) | 내부 어드민 | 모든 org·모든 자원 RW. 외부 어드민에 직접 로그인은 운영상 X |
| `study_center_users.role = 'admin'` | 자기 org 내 | 학생 RW, 담당자 초대·해제, 설정 변경 |
| `study_center_users.role = 'user'` | 자기 org 내 | 학생 RW, 설정 read-only, 담당자 관리 X |

RLS 자체는 org 경계만 검증. 같은 org 안의 admin/user 권한 분리는 **application 단(server action)** 에서 체크. 헬퍼:
```ts
export function isCenterAdmin(member: StudyCenterUser) {
  return member.role === 'admin' && member.status === 'active';
}
```

---

## 6. Server Action 패턴

```ts
// src/app/center/actions/students.ts
"use server";
import { requireCenterSession } from "@/lib/center/session";

export async function createStudent(formData: FormData) {
  const { supabase, member } = await requireCenterSession();  // 인증·org
  // zod 검증 → insert (RLS 자동, org_id = member.org_id 강제)
  // revalidatePath('/center/students')
}
```
- 모든 action 의 첫 줄: `requireCenterSession()`
- `org_id` 는 클라이언트가 보낸 값을 신뢰하지 않고 서버에서 `member.org_id` 로 강제
- 검증 실패 / 권한 부족은 표준 에러 형태로 반환 (toast 표시용)

---

## 7. 로그인 / 비밀번호 흐름 (B1 범위)

| 단계 | 화면 / 액션 |
|---|---|
| 1. 초대 메일 (운영팀) | 내부 어드민에서 `auth.admin.inviteUserByEmail` 호출, redirectTo = `/center/set-password` |
| 2. 비밀번호 설정 | `/center/set-password` (raw token 처리) → `/center/login` 으로 |
| 3. 로그인 | `/center/login` 이메일+비번 → 성공 시 `/center` 대시보드 |
| 4. 비밀번호 재설정 | `/center/login/reset` (Supabase 표준) |

소셜 로그인·MFA 는 B+ 범위.

---

## 8. B1 산출물 (구현 단계 체크리스트)

- [ ] `src/middleware.ts` — `/center/*` 인증 게이트
- [ ] `src/lib/supabase/center.ts`, `src/lib/supabase/center-client.ts`
- [ ] `src/lib/center/session.ts` — `requireCenterSession()`
- [ ] `src/lib/i18n.ts` — `center.*` 키 추가 (베/한 양쪽)
- [ ] `src/app/center/layout.tsx` (베트남어 폰트·기본 chrome)
- [ ] `src/app/center/login/page.tsx`
- [ ] `src/app/center/set-password/page.tsx`
- [ ] `src/app/center/(authed)/layout.tsx` — org 컨텍스트
- [ ] `src/app/center/(authed)/page.tsx` — 대시보드 MVP
- [ ] `src/app/center/(authed)/students/page.tsx` + `new` + `import` + `[id]`
- [ ] `src/app/center/(authed)/admissions/page.tsx` — 모집요강 조회
- [ ] `src/components/center/*` — 헤더·사이드바·표·페이지헤더
- [ ] `src/app/center/actions/students.ts` — CRUD
- [ ] `src/app/center/actions/applications.ts` — 지원 등록

---

## 9. 검증 단계 (B1 완료 기준)

1. 운영팀이 내부 어드민에서 테스트 org + 담당자 1명 생성 → 초대 메일 수신 → 비번 설정 → `/center` 로그인 성공
2. 로그인 상태에서 학생 1명 등록 → DB 의 `study_managed_students.org_id` 가 본인 org 와 일치
3. 다른 org 의 학생을 직접 URL(`/center/students/[id]`)로 접근 → RLS 가 403 (또는 빈 결과)
4. 모집요강 페이지에서 글로케어가 등록한 `approved` 항목만 보임
5. 로그아웃 후 `/center` 접근 → `/center/login` redirect
