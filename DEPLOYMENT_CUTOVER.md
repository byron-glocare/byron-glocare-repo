# Glocare — Monorepo Cutover 체크리스트

**언제 쓰는 문서**: 사용자가 "이제 모든 모노레포 작업을 prod 로 보내자" 결단할 때. 한 번만 실행.

**소요 시간**: 약 15분 (Vercel 설정 5분 × 3개 + GitHub 정리 5분)

**되돌리기**: 옛 main 은 `legacy/standalone-admin` 브랜치에 보존됨. 문제 시 `git push origin legacy/standalone-admin:main --force` 로 즉시 복구 가능.

---

## ⚠️ 시작 전 확인

다음 모두 ✅ 면 진행:

- [ ] monorepo `C:\dev\glocare` 의 `main` 브랜치 HEAD 가 **prod 갈 준비 된 상태**인가? (모든 채팅창의 hold 된 작업이 이 commit 에 포함되어도 OK?)
- [ ] `apps/admin` 으로 `npm run build` 가 통과하는가?
- [ ] `apps/abroad` 로 `npm run build` 가 통과하는가?
- [ ] `apps/caregiver` 로 `npm run build` 가 통과하는가?
- [ ] DB 마이그레이션 (apps/admin/supabase/migrations/) 이 라이브 Supabase 에 모두 적용되어 있는가?

하나라도 ❌ 면 cutover 중단하고 그 항목 먼저 해결.

---

## Step 1 — 백업 확인 (안전망)

```powershell
cd C:\dev\glocare
git fetch origin
git log origin/legacy/standalone-admin -1 --format="%h %ci %s"
```

`legacy/standalone-admin` 브랜치가 byron-glocare-repo 에 있어야 함. 없으면 먼저 백업:

```powershell
git push origin origin/main:refs/heads/legacy/standalone-admin
```

abroad / caregiver 의 옛 레포는 어차피 archive 되어 코드 자체가 GitHub 에 그대로 보존됨 — 별도 백업 불필요.

---

## Step 2 — monorepo main 을 byron-glocare-repo 로 force push

```powershell
cd C:\dev\glocare
git status                    # working tree clean 확인
git log main -1 --format="%h %ci %s"   # 어느 commit 이 prod 갈지 마지막 확인

# force push
git push origin main --force-with-lease
```

`--force-with-lease` 는 다른 사람이 그 사이 main 에 push 한 게 없을 때만 force 진행 (안전).

**이 시점에 Vercel 의 glocare_admin 이 자동 빌드 시도** — 옛 Root Directory (`./`) 기준이라 빌드 실패할 것. **사이트는 옛 빌드 그대로 살아있으니 안전**. 다음 Step 3 가 빠르게 진행되어야 prod 정상화.

---

## Step 3 — Vercel 의 admin 프로젝트: Root Directory 변경

1. https://vercel.com/dashboard → `glocare_admin` 클릭
2. Settings → Build and Deployment → **Root Directory**
3. 입력칸에 `apps/admin` 입력
4. **Save** 클릭
5. Save 누르면 자동으로 redeploy 트리거됨 → 빌드 성공해야 prod 업데이트

**확인**: 약 3분 뒤 `https://glocare-admin.vercel.app` 정상 동작 확인.

---

## Step 4 — Vercel 의 abroad 프로젝트: Git 연결 변경 + Root Directory

1. https://vercel.com/dashboard → `glocare-homepage-abroad` 클릭
2. Settings → Git → **Connected Git Repository**
   - Disconnect 클릭
   - Connect 클릭 → `byron-glocare/byron-glocare-repo` 선택
   - Production Branch = `main` 확인
3. Settings → Build and Deployment → **Root Directory** = `apps/abroad` 입력 + Save
4. Save 후 자동 redeploy → prod 정상 확인 (`youstudyinkorea.com`)

---

## Step 5 — Vercel 의 caregiver 프로젝트: Git 연결 변경 + Root Directory

Step 4 와 동일 절차:
1. `glocare-homepage-caregiver` Vercel 프로젝트
2. Git 연결을 `byron-glocare/byron-glocare-repo` 로 변경
3. Root Directory = `apps/caregiver`

---

## Step 6 — 옛 레포 archive 처리

GitHub 의:
- `byron-glocare/glocare-homepage-abroad`
- `byron-glocare/glocare-homepage-caregiver`

각각 Settings → Danger Zone → **Archive this repository**. 코드는 보존, 추가 push/issue/PR 차단.

(`byron-glocare/byron-glocare-repo` 는 archive 하면 안 됨 — 이게 새 모노레포의 그릇)

---

## Step 7 — README + WORKFLOW 갱신

`C:\dev\glocare\README.md` 의 "Vercel 프로젝트 (현재 상태)" 표에서 cutover 후 상태 반영:

| Vercel 프로젝트 | GitHub 연결 |
|---|---|
| glocare_admin | byron-glocare-repo + Root Directory=apps/admin ✅ |
| glocare-homepage-abroad | byron-glocare-repo + Root Directory=apps/abroad ✅ |
| glocare-homepage-caregiver | byron-glocare-repo + Root Directory=apps/caregiver ✅ |

`WORKFLOW.md` 의 "Section 4. prod 배포 상태" 의 "현재 (cutover 전)" 섹션 삭제, "cutover 후" 만 남김.

---

## Step 8 — Smoke Test

세 사이트 모두 접속해서 핵심 기능 동작 확인:
- glocare-admin.vercel.app — 로그인 + 대시보드 + 교육생 리스트
- youstudyinkorea.com — 메인 페이지 + 상담 신청 폼
- glocare-homepage-caregiver.vercel.app — 메인 페이지

---

## 🚨 문제 발생 시 즉시 복구

```powershell
cd C:\dev\glocare
git push origin legacy/standalone-admin:main --force
```

그 다음 Vercel 의 Root Directory 들을 원래대로 (admin: `./`, abroad/caregiver: 옛 레포로 재연결) — 약 5분이면 prod 복구.

---

## ✅ cutover 완료 후

- 모든 admin/abroad/caregiver 변경이 `git push origin main` 만으로 자동 prod 배포
- 다른 채팅창 hold 정책 해제 (이제 commit + push = prod)
- 이 문서는 archive 폴더 등으로 옮기거나 "✅ 실행 완료" 표시 추가
