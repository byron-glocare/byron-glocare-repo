# QC — Glocare 통합 (admin + homepage)

**작성**: 2026-04-28
**범위**: 최근 추가된 유학 도메인 (admin CRUD 6종 + homepage 풀버전)
**제외**: 요양보호사 도메인 기존 기능 (변경 없음)

---

## ① 정적 검증 (자동)

| 항목 | admin | homepage |
|---|---|---|
| `npx tsc --noEmit` | ✅ | ✅ |
| `npm run build` | ✅ (6.9 분, 13/13 페이지) | ✅ (10/10 페이지) |
| `npm run lint` | ⚠️ 33 errors | ✅ |
| `git status` clean | ✅ | ✅ |
| 모든 라우트 등록 | ✅ | ✅ |

**lint 33 errors 분석:**
- `customer-status.test.ts`: 16개 (any types) — 기존 파일, 변경 안 함
- `settlement-pending-center-row.tsx`: 2 warnings (unused vars) — 기존 파일
- 나머지: react-hooks/set-state-in-effect 1개 — 기존 파일
- ✅ **새로 만든 파일 (study-* / department-form / 등) 은 lint clean**

---

## ② Admin — Dashboard (`/`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 페이지 로드 | ⬜ | |
| 기존 요양보호사 카드 (TaskCards/단계 분포) 표시 | ⬜ | 회귀 확인 |
| 유학생 도메인 stats 6종 표시 (대학·학과·센터·사례·상담·보험) | ⬜ | |
| 카운트가 DB 활성 row 수와 일치 | ⬜ | |
| 상담/보험 카드 우측 상단 미확인 inbox 뱃지 | ⬜ | status='미확인' 수 |
| 카드 클릭 시 해당 페이지로 이동 | ⬜ | |
| 상담/보험 카드는 `?tab=` 파라미터까지 포함 | ⬜ | |

---

## ③ Admin — Universities (`/universities`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 목록 페이지 로드 + 헤더 "+ 대학 등록" 버튼 | ⬜ | |
| 행 클릭 → `/universities/[id]` 이동 (cursor-pointer) | ⬜ | |
| 학과 수 카운트 정확 (active만) | ⬜ | |
| 등록 페이지 폼 모든 필드 표시 | ⬜ | name_ko 필수 |
| 등록 → 목록에 새 행 등장 | ⬜ | |
| 편집 페이지: 기존 값 prefill | ⬜ | |
| 저장 후 `navigateBackOrTo('/universities')` 동작 | ⬜ | |
| 편집 페이지 하단 학과 sub-table | ⬜ | |
| sub-table 행 클릭 → `/departments/[id]` | ⬜ | |
| "+ 학과 추가" 버튼 → `?university_id=X` 프리필 | ⬜ | |
| 삭제: 학과 있을 때 차단 | ⬜ | error toast |
| 삭제: 학과 없을 때 성공 | ⬜ | redirect to /universities |

---

## ④ Admin — Departments (`/departments`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 목록 + 대학 필터 칩 | ⬜ | |
| `?uni=N` 필터 동작 | ⬜ | |
| "전체" 칩 클릭 → 필터 해제 | ⬜ | |
| 행 클릭 → `/departments/[id]` | ⬜ | |
| 대학 컬럼 클릭 → `/universities/[id]` (별도 링크) | ⬜ | |
| 등록 폼: 대학 select / icon / name_ko / 코스 / 뱃지 / 학비 / 장학금 / sort_order | ⬜ | |
| 코스 select: "" (모두), "direct", "language" | ⬜ | |
| 뱃지 select: "" / "hot" / "good" | ⬜ | |
| degree_years number input | ⬜ | |
| sort_order number input | ⬜ | |
| 편집: 모든 값 prefill | ⬜ | |
| 삭제 → /departments | ⬜ | |
| `?university_id=X` 진입 시 select 프리필 + backHref 변경 | ⬜ | |

---

## ⑤ Admin — Study Centers (`/study-centers`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 목록 표시 | ⬜ | |
| 행 클릭 → 편집 | ⬜ | |
| name_vi 필수 | ⬜ | |
| 등록/편집/삭제 | ⬜ | |
| 베트남 국기 (flag) 입력 | ⬜ | |

---

## ⑥ Admin — Study Cases (`/study-cases`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 목록: hero=1,2,3 먼저 → hero=N 나중에 (정렬 확인) | ⬜ | |
| Hero 뱃지 vs Cases 뱃지 표시 | ⬜ | |
| 썸네일 표시 (tiktok_thumb 있을 때) | ⬜ | |
| 등록 폼 hero select: N / 1 / 2 / 3 | ⬜ | |
| active 체크박스 | ⬜ | |
| TikTok URL 입력 (필수 아님) | ⬜ | |
| 카테고리/제목 한·베 4필드 | ⬜ | |
| 등록 후 목록에 새 행 | ⬜ | |
| 편집 → 저장 | ⬜ | |
| 삭제 → 목록 | ⬜ | |

---

## ⑦ Admin — Study Channels (`/study-channels`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 목록 (sort_order 정렬) | ⬜ | |
| type select: tiktok/facebook/instagram/youtube/kakao/website | ⬜ | |
| handle / url / icon 입력 | ⬜ | |
| 등록/편집/삭제 | ⬜ | |
| URL 컬럼은 외부 새창 (target=_blank), 클릭 시 행 이동 X | ⬜ | 의도적 |

---

## ⑧ Admin — Students Inbox (`/students`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 상담 / 보험 탭 카운트 정확 | ⬜ | |
| 미확인 ping 뱃지 표시 | ⬜ | |
| 상태 셀 호버 → 펜슬 아이콘 표시 | ⬜ | |
| 펜슬 클릭 → select 표시 | ⬜ | |
| select 변경 → save → 페이지 갱신 | ⬜ | |
| 메모 셀 클릭 → textarea | ⬜ | |
| 메모 저장 → revalidate | ⬜ | |
| 빈 메모 → "+ 메모" placeholder | ⬜ | |
| insurance 탭에서도 동일 동작 | ⬜ | |

---

## ⑨ Admin — Nav

| 항목 | 상태 | 비고 |
|---|---|---|
| 유학생 그룹: 유학생 / 대학교 / 학과 / 유학센터 / 사례 / SNS 채널 6개 | ⬜ | |
| 모든 아이콘 표시 | ⬜ | |
| 현재 페이지 active highlight | ⬜ | |

---

## ⑩ Homepage — Header (`https://youstudyinkorea.com/`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 코랄 LangBar 표시 | ⬜ | |
| 🇻🇳 / 🇰🇷 토글 → 즉시 언어 전환 | ⬜ | cookie 'locale' 저장 |
| sticky nav 동작 (스크롤해도 상단 고정) | ⬜ | |
| 로고 클릭 → / | ⬜ | |
| 메뉴 6개 (사례/대학/리쿠르팅/센터/보험/About) | ⬜ | |
| About 메뉴 코랄 border | ⬜ | |
| "보험" 메뉴 코랄 색상 강조 | ⬜ | |
| 상담 신청 CTA 코랄 배경 | ⬜ | |
| 모바일: 햄버거 → mob-menu 슬라이드 | ⬜ | |

---

## ⑪ Homepage — Hero

| 항목 | 상태 | 비고 |
|---|---|---|
| 베트남 국기 배지 표시 | ⬜ | |
| 타이틀 + sub-line | ⬜ | i18n |
| 두 CTA 버튼 (코랄 / ghost) | ⬜ | |
| 우측 영상 카드: hero=1, 2, 3 인 사례만 | ⬜ | hero=N 제외 |
| 영상 카드 9:16 비율 | ⬜ | |
| 텍스트 없음 (영상만) | ⬜ | 사용자 요구 |
| 썸네일 표시 (oEmbed 자동 추출) | ⬜ | /api/tt-thumb |
| 카드 클릭 → TikTok 영상 새 창 | ⬜ | |
| 호버 시 play 아이콘 scale | ⬜ | |

---

## ⑫ Homepage — Cases (`#cases`)

| 항목 | 상태 | 비고 |
|---|---|---|
| hero=N 인 사례만 표시 | ⬜ | |
| 카테고리 태그 칩 | ⬜ | |
| 썸네일 표시 (oEmbed) | ⬜ | |
| 카드 클릭 → TikTok | ⬜ | |
| 모바일: 1 컬럼 / 태블릿 2 / 데스크탑 4 | ⬜ | |

---

## ⑬ Homepage — Universities (`#universities`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 코스 탭: "바로 진학" / "어학당 경유" 토글 | ⬜ | |
| 탭 변경 → 학과 필터링 (course 컬럼 매칭) | ⬜ | |
| 대학 카드 그리드 표시 | ⬜ | |
| emoji + name + region | ⬜ | |
| 학과 4개까지만 표시 | ⬜ | |
| dept_badge (hot/good) 표시 | ⬜ | |
| 태그 chip row | ⬜ | |
| 카드 클릭 → 모달 열림 | ⬜ | |
| 모달: 대학 특징 + 학과별 학비/장학금/수학기간/홈페이지 | ⬜ | |
| 모달 ESC / 백드롭 클릭 → 닫힘 | ⬜ | |

---

## ⑭ Homepage — Apply (`#apply`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 5단계 process strip | ⬜ | |
| 폼 모든 필드 (name/phone/email/age/dept/center/message/recruit/agree) | ⬜ | |
| dept select: 6개 옵션 + 기타 | ⬜ | |
| center select: 베트남 63 성/시 | ⬜ | |
| agree 미체크 → submit 차단 + toast 에러 | ⬜ | |
| submit → study_contacts insert | ⬜ | |
| success state 표시 | ⬜ | |
| Resend 운영자 알림 발송 | ⬜ | RESEND_API_KEY 필요 |
| 고객 confirmation (email 입력 시) | ⬜ | |

---

## ⑮ Homepage — Recruiting (`#recruiting`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 코랄 그라디언트 배경 | ⬜ | |
| recruit-eyebrow + 타이틀 | ⬜ | |
| 3 step (소개 → 등록 → 리워드) | ⬜ | |
| 2 program 카드 (Recruiting / Buddy) | ⬜ | |
| reward grid 3개 | ⬜ | |
| 상품권 리스트 박스 | ⬜ | |
| "지금 친구 소개하기" CTA → /#apply | ⬜ | |

---

## ⑯ Homepage — Centers (`#centers`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 베트남 협력 센터 그리드 | ⬜ | |
| 국기 + 이름 + 도시 + 메타 | ⬜ | |

---

## ⑰ Homepage — Insurance Refund Form (`#insurance-refund`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 폼 표시 | ⬜ | |
| 외국인등록번호 hint 표시 | ⬜ | |
| Zalo 번호 hint 표시 | ⬜ | |
| "모두 동의" → 두 체크박스 같이 토글 | ⬜ | |
| "내용 보기" → 약관 펼침/닫힘 | ⬜ | |
| 필수 동의 체크 안 하면 submit 비활성 | ⬜ | |
| submit → study_insurance_claims insert | ⬜ | |
| success state 표시 | ⬜ | |
| 외국인등록번호 문의 박스 (hikorea 링크) | ⬜ | |

---

## ⑱ Homepage — Insurance Info (`#insurance-info`)

| 항목 | 상태 | 비고 |
|---|---|---|
| Hero banner (300억) | ⬜ | |
| 4 detail item (목적/대상/보험료/회사) | ⬜ | |
| 3 case item (수령 가능 케이스) | ⬜ | |
| 알림 (notice) 박스 | ⬜ | |
| 2 method card (2024.12 전후) | ⬜ | |
| 경고 (warning) 박스 (3년 청구 기한) | ⬜ | |

---

## ⑲ Homepage — Floating + Popup

| 항목 | 상태 | 비고 |
|---|---|---|
| 우하단 fixed: Zalo 파란색 + 전화 녹색 | ⬜ | |
| pulse 애니메이션 | ⬜ | |
| 전화 버튼 → tel:0977456324 | ⬜ | |
| Zalo 버튼 → QR 모달 | ⬜ | |
| QR 모달: 백드롭 클릭 닫힘, 닫기 버튼 | ⬜ | |
| 보험 popup: 페이지 로드 2초 후 등장 | ⬜ | |
| "오늘 하루 보지 않기" → localStorage 24h 저장 | ⬜ | |
| popup CTA → #insurance-refund 스크롤 + 닫힘 | ⬜ | |

---

## ⑳ Homepage — About (`/about`)

| 항목 | 상태 | 비고 |
|---|---|---|
| 다크 네이비 hero | ⬜ | |
| 3 stat strip (8% / 50K+ / 23+) | ⬜ | |
| CEO message 4 블록 | ⬜ | |
| CEO closing + 사인 | ⬜ | |
| Partner type 4 카드 (유학센터/대학/채용/기타) | ⬜ | |
| Partner 폼 → study_contacts (recruiting='partner') | ⬜ | |
| Channel grid: study_channels 자동 fetch | ⬜ | |
| 채널별 그라디언트 배경 (TikTok/FB/IG/Web) | ⬜ | |
| 외부 링크 새 창 | ⬜ | |

---

## ㉑ Homepage — i18n

| 항목 | 상태 | 비고 |
|---|---|---|
| 기본 vi (베트남어) | ⬜ | |
| ko 토글 → 모든 텍스트 한국어 | ⬜ | |
| cookie 'locale' 1년 저장 | ⬜ | |
| 새로고침해도 언어 유지 | ⬜ | |

---

## ㉒ Homepage — TikTok 썸네일 프록시 (`/api/tt-thumb`)

| 항목 | 상태 | 비고 |
|---|---|---|
| `?url=https://www.tiktok.com/...` GET → 200 image/jpeg | ⬜ | |
| 잘못된 도메인 URL → 400 | ⬜ | |
| Edge cache headers 적용 | ⬜ | |
| oEmbed 실패 → 502 | ⬜ | graceful degradation |

---

## ㉓ Homepage — 데이터 연결

| 항목 | 상태 | 비고 |
|---|---|---|
| Supabase RLS: anon 으로 active=true 만 노출 | ⬜ | |
| 비활성 (active=false) 사례·대학 노출 안 됨 | ⬜ | |
| /apply submit → admin /students 에서 즉시 조회 가능 | ⬜ | |
| /insurance submit → admin /students?tab=insurance 즉시 조회 | ⬜ | |
| /about partner → admin /students 에서 recruiting='partner' 표시 | ⬜ | |

---

## ㉔ 알려진 외부 의존성

| 항목 | 상태 | 비고 |
|---|---|---|
| Resend `RESEND_API_KEY` 설정 | ⬜ | Vercel env |
| Resend `RESEND_FROM_EMAIL` 설정 | ⬜ | onboarding@resend.dev or help@glocare.co.kr |
| Resend `RESEND_NOTIFY_EMAIL` 설정 | ⬜ | kajkaj202@gmail.com |
| Supabase URL / anon key | ⬜ | 양 프로젝트 |
| Vercel 도메인: youstudyinkorea.com → DNS 정상 | ⬜ | |
| Vercel 도메인: glocare-customer.vercel.app | ⬜ | |

---

## 발견된 이슈

| # | 위치 | 증상 | 우선순위 | 상태 |
|---|---|---|---|---|
| 1 | admin `/study-cases` HeroBadge | `bg-coral/10` 사용했으나 admin Tailwind 에 coral 토큰 없음 (homepage 에만 있음). admin 은 `--primary` (#ff6060) 가 같은 색조. 결과: Hero 1/2/3 뱃지 배경 색이 안 나옴. | 중 | ✅ 수정 (`bg-primary/10`) |
| 2 | homepage 구 라우트 `/apply`, `/cases`, `/centers`, `/insurance`, `/universities`, `/universities/[id]` | 초기 스캐폴딩 때 만든 shadcn 스타일 페이지가 그대로 남아있음. 새 디자인 (단일 페이지) 에서 링크 안 됨 (모두 `/#anchor` 사용). 직접 URL 접근 시 깨진 스타일 (admin 토큰 안 있음). | 낮 | ⬜ 별도 작업 (삭제 or redirect 결정 필요) |
| 3 | homepage `contact-form.tsx`, `insurance-form.tsx` | 구 폼 컴포넌트. 새 디자인은 `apply.tsx` / `insurance-refund.tsx` 사용. 더 이상 import 안 됨. | 낮 | ⬜ 삭제 후보 |
| 4 | homepage `locale-switch.tsx` | 구 컴포넌트. 새 디자인은 `lang-bar.tsx` 사용. 더 이상 import 안 됨. | 낮 | ⬜ 삭제 후보 |
| 5 | admin `study_cases` admin lint check | 새 파일 0 lint 에러 ✅ | — | clean |
| 6 | homepage 의 `bg-card`, `text-muted-foreground` 등 shadcn 토큰 | 구 라우트들 (`/apply`, `/cases` 등) 에서만 사용. 새 디자인 페이지에는 없음. | 낮 | ⬜ #2 삭제하면 자동 해결 |

---

## 회귀 테스트 (요양보호사 측)

내가 손댄 곳 (있으면): nav.ts, page.tsx (대시보드 추가), validators.ts (append만)

| 항목 | 상태 | 비고 |
|---|---|---|
| 대시보드 기존 카드 그대로 표시 | ⬜ | |
| nav 의 요양보호사 그룹 5개 메뉴 정상 | ⬜ | |
| /customers, /training-centers, /care-homes, /sms, /settlements 정상 | ⬜ | |
| validators.ts 의 trainingCenter/careHome/customer 스키마 영향 없음 | ⬜ | append-only 였음 |
