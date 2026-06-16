# Caregiver 배포·설정 체크리스트

서비스 확장(가입·결제·알림톡) 관련 코드는 완료. 아래는 **배포/외부설정** 단계에서 할 일.

## 1. 환경변수 (.env.local 로컬 / Vercel 운영)
`.env.example` 참고. 신규 추가분:
- `SUPABASE_SERVICE_ROLE_KEY` — 결제 확정 기록(서버 전용). ⚠️ NEXT_PUBLIC 금지.
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` — 토스(테스트키로 먼저).
- `NHN_SMS_APP_KEY` / `NHN_SMS_SECRET_KEY` / `NHN_SMS_SEND_NO` — 전화 OTP 발송(admin 과 동일 계정).
- `SEND_SMS_HOOK_SECRET` — Supabase Send SMS Hook 시크릿.
- `NHN_ALIMTALK_APPKEY/SECRETKEY/SENDERKEY/TEMPLATE_CODE` — 매일 CBT 알림톡(기존 AWS 발송분 재사용).
- `CRON_SECRET` — Vercel Cron 보호.

## 2. Supabase 마이그레이션 (SQL 에디터 paste, 순서대로)
0012 → 0013 → 0014 → 0015 → 0016. (0012~0015 적용 완료, 0016 결제 RPC paste 필요)

## 3. 전화번호 OTP 가입
- Supabase: Auth → Providers → **Phone 켜기**.
- Auth → Hooks → **Send SMS Hook** = `https://<배포도메인>/api/auth/sms-hook`, 시크릿을 `SEND_SMS_HOOK_SECRET` 에 저장.
- ⚠️ 로컬 불가(클라우드가 localhost 못 닿음) → 배포 후 테스트.

## 4. 토스 결제
- 토스 대시보드에서 **테스트 키** 발급(가맹 전 가능) → env.
- (운영 전) 가맹 심사 완료 후 라이브 키로 교체.
- 웹훅(가상계좌 입금완료): 토스 대시보드 → 웹훅 URL = `https://<배포도메인>/api/toss/webhook`.
- 카드/계좌이체는 로컬에서도 테스트키로 검증 가능. 가상계좌 입금완료는 배포 후.

## 5. 매일 CBT 알림톡
- `vercel.json` 크론 등록됨: `/api/cron/cbt-reminder`, `0 0 * * *`(UTC) = 09:00 KST. 시각 조정은 schedule 변경.
- NHN_ALIMTALK_* env 채우기. templateParameter 키(`name` 등)는 **승인된 템플릿 변수에 맞춰** `route.ts` 조정.
- ⚠️ **AWS 기존 발송 중단**(컷오버) — 안 끄면 이중 발송.

## 6. Vimeo 유료 콘텐츠 보호 (콘솔 설정)
- Vimeo 각 영상 → Privacy → **"Where can this be embedded?" = Specific domains** → 배포 도메인 추가.
- Privacy → **Hide from Vimeo**(vimeo.com 검색/직접재생 차단).
- 이러면 `vimeo_id` 가 유출돼도 외부 도메인/직접 재생 불가.

## 7. 런칭 직전
- `app_users` 에서 테스트용 **고객** 계정 제외(직원 시드 정리). 0013 주석 참고.
- 게이트: `BYPASS_GATES` 는 이미 제거됨(날짜 기반). 교육 시작/종료일 세팅 확인.
