# QA 체크리스트 v2 (정밀판)

**기준:** 개발지시서 v1.2 + Phase 1~10 전체 구현
**작성일:** 2026-04-22
**목표:** 기능 오류 0 — 폼 필드·에러 경로·edge case 전수 커버

---

## 1. 자동 검증 (실행 전제)

- [ ] 1.1 TypeScript `tsc --noEmit` 통과
- [ ] 1.2 Vitest 전체 테스트 통과
- [ ] 1.3 `npm run build` 프로덕션 빌드 성공
- [ ] 1.4 ESLint 에러 없음
- [ ] 1.5 `scripts/qa-verify.ts` 전체 통과
- [ ] 1.6 `0003_dummy_data.sql` 투입 후 테이블 행수 검증 (customers 17, centers 5, homes 3, classes 6)

---

## 2. 인증/세션 (auth)

### 2.A 로그인 폼 입력 검증

- [ ] 2.A.1 유효한 이메일/비번으로 로그인 성공
- [ ] 2.A.2 잘못된 이메일 형식 ("abc", "abc@", "@abc.com") → zod 에러 메시지
- [ ] 2.A.3 빈 이메일 → 필수 검증
- [ ] 2.A.4 빈 비밀번호 → 필수 검증
- [ ] 2.A.5 비밀번호 5자 (6자 미만) → 에러
- [ ] 2.A.6 존재하지 않는 이메일 → Supabase 에러 토스트
- [ ] 2.A.7 이메일 정확, 비번 틀림 → 토스트
- [ ] 2.A.8 비활성화된(banned) 계정 → 토스트
- [ ] 2.A.9 이메일 대소문자 구분 (Supabase는 대소문자 무시)
- [ ] 2.A.10 이메일 앞뒤 공백 → trim 처리
- [ ] 2.A.11 비밀번호 앞뒤 공백 → 구분됨 (trim 안 함)
- [ ] 2.A.12 연속 실패 시도 → Supabase 기본 rate limit 동작

### 2.B 세션/쿠키/리다이렉트

- [ ] 2.B.1 미로그인 `GET /` → 307 `/login?redirect=%2F`
- [ ] 2.B.2 미로그인 `GET /customers/:id` → `/login?redirect=%2Fcustomers%2F:id`
- [ ] 2.B.3 로그인 후 redirect 파라미터로 원래 페이지로 복귀
- [ ] 2.B.4 로그인 상태에서 `/login` 접근 → `/` 로 redirect
- [ ] 2.B.5 로그아웃 → `/login` redirect + 세션 쿠키 제거
- [ ] 2.B.6 `redirect=//evil.com` 외부 URL 차단 (open-redirect 방어)
- [ ] 2.B.7 `redirect=javascript:alert(1)` 차단
- [ ] 2.B.8 `redirect=/valid%20path` 인코딩된 내부 경로 허용
- [ ] 2.B.9 미로그인 `GET /api/translate` → 401 JSON (HTML 리다이렉트 아님)
- [ ] 2.B.10 미로그인 `GET /api/sms/send` → 401 JSON
- [ ] 2.B.11 세션 만료 후 API 호출 → 401
- [ ] 2.B.12 쿠키 httpOnly 설정 확인

### 2.C 정적 자산 공개

- [ ] 2.C.1 `/glocare_logo.png` 미로그인 접근 가능 (200)
- [ ] 2.C.2 `/favicon.ico` 미로그인 접근 가능
- [ ] 2.C.3 `/_next/static/*` 공개
- [ ] 2.C.4 `/_next/image?...` 공개 (이미지 최적화)

---

## 3. DB 스키마/무결성

### 3.A 테이블 존재 & 트리거

- [ ] 3.A.1 13개 테이블 모두 존재
- [ ] 3.A.2 `updated_at` 트리거 각 테이블 동작 (UPDATE 후 시각 갱신)
- [ ] 3.A.3 customers INSERT 시 customer_statuses 자동 생성 (1:1)
- [ ] 3.A.4 customer_statuses 중복 insert 시도 시 ON CONFLICT DO NOTHING (트리거 재실행 안전)
- [ ] 3.A.5 pgcrypto 확장 활성화 (gen_random_uuid 동작)

### 3.B Generated column

- [ ] 3.B.1 welcome_pack_payments.final_amount = total_price - discount_amount (자동)
- [ ] 3.B.2 final_amount INSERT 시 값 지정 불가 (generated)

### 3.C Check 제약

- [ ] 3.C.1 customers.gender IN ('남','여') OR NULL — 다른 값 거부
- [ ] 3.C.2 customers.desired_time IN ('주간','야간') OR NULL
- [ ] 3.C.3 customers.product_type IN ('교육','웰컴팩','교육+웰컴팩') OR NULL
- [ ] 3.C.4 customers.termination_reason enum 제약
- [ ] 3.C.5 customers.waiting_memo ≤ 500 chars
- [ ] 3.C.6 training_classes.month BETWEEN 1 AND 12
- [ ] 3.C.7 training_classes.class_type IN ('weekday','night')
- [ ] 3.C.8 customer_consultations.consultation_type 제약
- [ ] 3.C.9 commission_payments.status enum
- [ ] 3.C.10 reservation_payments.refund_reason 4가지 enum

### 3.D Foreign Key 동작

- [ ] 3.D.1 customers 삭제 → customer_statuses CASCADE
- [ ] 3.D.2 customers 삭제 → customer_consultations CASCADE
- [ ] 3.D.3 customers 삭제 → reservation_payments CASCADE
- [ ] 3.D.4 customers 삭제 → commission_payments CASCADE
- [ ] 3.D.5 customers 삭제 → event_payments CASCADE
- [ ] 3.D.6 customers 삭제 → welcome_pack_payments CASCADE
- [ ] 3.D.7 customers 삭제 → sms_messages.target_customer_id SET NULL
- [ ] 3.D.8 training_centers 삭제 → customers.training_center_id SET NULL
- [ ] 3.D.9 training_centers 삭제 → training_classes CASCADE
- [ ] 3.D.10 training_centers 삭제 시 commission_payments 있으면 RESTRICT (삭제 실패)
- [ ] 3.D.11 care_homes 삭제 → customers.care_home_id SET NULL
- [ ] 3.D.12 training_classes 삭제 → customers.training_class_id SET NULL
- [ ] 3.D.13 event_payments.friend_customer_id SET NULL 시 reflexive 처리

### 3.E Unique 제약

- [ ] 3.E.1 customers.code UNIQUE
- [ ] 3.E.2 training_centers.code UNIQUE (nullable)
- [ ] 3.E.3 care_homes.code UNIQUE (nullable)
- [ ] 3.E.4 status_options.code UNIQUE
- [ ] 3.E.5 system_settings.key PK
- [ ] 3.E.6 welcome_pack_payments.customer_id UNIQUE
- [ ] 3.E.7 customer_statuses.customer_id PK (1:1)

### 3.F RLS 정책

- [ ] 3.F.1 모든 테이블 RLS ENABLED
- [ ] 3.F.2 미인증 anon 키로 SELECT 거부
- [ ] 3.F.3 인증 사용자 SELECT 허용
- [ ] 3.F.4 인증 사용자 INSERT/UPDATE/DELETE 허용
- [ ] 3.F.5 service_role RLS 우회 확인

---

## 4. 교육원 (/training-centers)

### 4.A 목록 페이지

- [ ] 4.A.1 빈 상태 (교육원 0개) → 안내 메시지 + "첫 등록" 링크
- [ ] 4.A.2 정상 렌더 (더미 5개)
- [ ] 4.A.3 소속 교육생 수 카운트 정확
- [ ] 4.A.4 "교육원 등록" 버튼 클릭 → /new
- [ ] 4.A.5 행 클릭 → /[id]
- [ ] 4.A.6 내일배움카드 true/false 뱃지
- [ ] 4.A.7 2026 수강료 표시 형식 (원, 천단위 콤마)
- [ ] 4.A.8 code null인 센터 → "—" 표시
- [ ] 4.A.9 정렬 순서 (이름 오름차순)

### 4.B 등록 폼 (/training-centers/new)

- [ ] 4.B.1 이름 빈값 → 에러
- [ ] 4.B.2 이름 공백만 → 에러 (trim)
- [ ] 4.B.3 이름만 입력 → 성공 생성
- [ ] 4.B.4 모든 필드 입력 → 성공
- [ ] 4.B.5 수강료 문자 입력 → NaN → null 저장
- [ ] 4.B.6 수강료 천단위 콤마 ("1,200,000") → 1200000 저장
- [ ] 4.B.7 수강료 음수 → 저장은 되나 check 제약 없음 (확인)
- [ ] 4.B.8 이메일 형식 무효 → Supabase 저장 허용 (서버 스키마 없음, 확인 필요)
- [ ] 4.B.9 전화번호 자유 형식 저장
- [ ] 4.B.10 사업자등록번호 자유 형식
- [ ] 4.B.11 code 중복 → UNIQUE 위반 에러 메시지 토스트
- [ ] 4.B.12 내일배움카드 토글 상태 저장
- [ ] 4.B.13 메모 긴 텍스트 (10000자) → 저장
- [ ] 4.B.14 Unicode/이모지 입력 → 저장
- [ ] 4.B.15 SQL injection 시도 ("'; DROP TABLE...") → 정상 저장 (파라미터화)
- [ ] 4.B.16 XSS 시도 ("<script>") → 정상 저장 (렌더 시 React 자동 이스케이프)
- [ ] 4.B.17 동시에 같은 code로 두 개 등록 시도 → 하나만 성공
- [ ] 4.B.18 취소 버튼 → router.back()
- [ ] 4.B.19 등록 중 pending 상태 버튼 비활성
- [ ] 4.B.20 생성 성공 → /training-centers/[id] 리다이렉트

### 4.C 상세 페이지 (/training-centers/[id])

- [ ] 4.C.1 존재하지 않는 id → 404
- [ ] 4.C.2 잘못된 uuid 포맷 ("abc") → 404
- [ ] 4.C.3 유효한 교육원 → 폼 초기값으로 로드
- [ ] 4.C.4 이름 수정 → 저장 → 목록에 반영
- [ ] 4.C.5 수정 중 취소 → 변경 되돌리기?
- [ ] 4.C.6 내일배움카드 토글만 변경 → 저장
- [ ] 4.C.7 이름을 빈값으로 변경 → 에러
- [ ] 4.C.8 updated_at 자동 갱신
- [ ] 4.C.9 소속 교육생 목록 표시 (해당 센터만)
- [ ] 4.C.10 교육생 0명일 때 빈 상태 표시
- [ ] 4.C.11 educational classes 월별 개강 섹션 표시

### 4.D 월별 개강 (TrainingClassesManager)

- [ ] 4.D.1 빈 상태 안내 메시지
- [ ] 4.D.2 추가: 유효 연/월/구분/시작일/종료일 → 성공
- [ ] 4.D.3 추가 후 폼 날짜 리셋 (연/월/구분은 유지)
- [ ] 4.D.4 연도 1900 → 에러 (2020+)
- [ ] 4.D.5 연도 2101 → 에러 (2100 이하)
- [ ] 4.D.6 월 0 → 에러
- [ ] 4.D.7 월 13 → 에러
- [ ] 4.D.8 주간/야간 외 값 불가 (select만)
- [ ] 4.D.9 종료일 < 시작일 → 저장은 되나 논리 에러 (확인)
- [ ] 4.D.10 시작일/종료일 빈값 → 저장 허용 (text field like)
- [ ] 4.D.11 삭제 버튼 클릭 → 즉시 삭제
- [ ] 4.D.12 매칭된 교육생 있는 클래스 삭제 시도 → 에러 토스트
- [ ] 4.D.13 같은 연/월/구분 중복 등록 → 허용 (제약 없음, 의도?)
- [ ] 4.D.14 정렬: 최신 연도/월 우선
- [ ] 4.D.15 추가 중 pending 상태

### 4.E 삭제

- [ ] 4.E.1 소속 교육생 0명 → 삭제 다이얼로그 → 확인 → /training-centers 복귀
- [ ] 4.E.2 소속 교육생 있음 → 삭제 차단 + 에러 토스트 (N명)
- [ ] 4.E.3 commission_payments 있음 → DB ON DELETE RESTRICT 로 실패 확인
- [ ] 4.E.4 month 개강 정보는 CASCADE 로 함께 삭제
- [ ] 4.E.5 삭제 다이얼로그 취소 → 삭제 안 됨

### 4.F 서버 액션 검증

- [ ] 4.F.1 createTrainingCenter: 빈 이름 → 에러
- [ ] 4.F.2 updateTrainingCenter: 존재하지 않는 id → RLS/404
- [ ] 4.F.3 deleteTrainingCenter: 미인증 호출 → 실패
- [ ] 4.F.4 createTrainingClass: training_center_id 외래키 위반 → 에러
- [ ] 4.F.5 deleteTrainingClass: 존재하지 않는 id → no-op
- [ ] 4.F.6 revalidatePath 호출로 목록 즉시 반영

---

## 5. 요양원 (/care-homes)

### 5.A 목록/등록/상세

- [ ] 5.A.1 빈 상태 메시지
- [ ] 5.A.2 목록 렌더
- [ ] 5.A.3 소속 교육생 수 카운트
- [ ] 5.A.4 등록 → 상세로 리다이렉트
- [ ] 5.A.5 이름 빈값 → 에러
- [ ] 5.A.6 수정/저장
- [ ] 5.A.7 404 (존재하지 않는 id)
- [ ] 5.A.8 code 중복 → 에러

### 5.B 매칭 교육생 분류

- [ ] 5.B.1 면접/취업 대기 (work_start_date null, interview_date 있음)
- [ ] 5.B.2 근무 중 (work_start_date ≤ today, work_end_date null)
- [ ] 5.B.3 근무 종료 (work_end_date 있음)
- [ ] 5.B.4 빈 분류는 렌더링 생략
- [ ] 5.B.5 고객 이름 한국어 우선, 없으면 베트남어

### 5.C 삭제

- [ ] 5.C.1 매칭 교육생 있으면 차단
- [ ] 5.C.2 없으면 삭제 성공

---

## 6. 고객관리 (/customers)

### 6.A 목록 페이지

- [ ] 6.A.1 빈 상태
- [ ] 6.A.2 50행 페이지네이션 초과 (51번째 2페이지)
- [ ] 6.A.3 검색 q= 빈 문자열 → 전체 표시
- [ ] 6.A.4 검색 한국어 부분 일치
- [ ] 6.A.5 검색 베트남어 부분 일치
- [ ] 6.A.6 검색 전화 부분 일치
- [ ] 6.A.7 검색 코드 (CVN...) 부분 일치
- [ ] 6.A.8 검색 대소문자 무관 (ilike)
- [ ] 6.A.9 검색 특수문자 , ( ) → sanitize 적용
- [ ] 6.A.10 검색 % → 와일드카드 영향 (의도된 동작)
- [ ] 6.A.11 검색 SQL injection → 정상 처리
- [ ] 6.A.12 센터 필터 단일
- [ ] 6.A.13 센터 + 요양원 필터 조합
- [ ] 6.A.14 필터 선택 후 페이지 번호 유지
- [ ] 6.A.15 초기화 버튼 → 모든 파라미터 제거
- [ ] 6.A.16 잘못된 페이지 번호 (?page=999) → 빈 결과
- [ ] 6.A.17 ?page=0 → 1로 처리
- [ ] 6.A.18 ?page=-5 → 1로 처리
- [ ] 6.A.19 ?page=abc → 1로 처리
- [ ] 6.A.20 단계 뱃지 9가지 색상 매핑 확인 (접수중/예약중/교육중/취업중/근무중/근무종료/대기중/종료)
- [ ] 6.A.21 나이 계산 (생년 1990 → 36세)
- [ ] 6.A.22 birth_year null → "—"
- [ ] 6.A.23 이름 null 둘 다 → "(이름 없음)" 또는 공백 처리
- [ ] 6.A.24 긴 이름 테이블 레이아웃 깨짐 방지
- [ ] 6.A.25 행 Link 클릭 영역 전체 커버
- [ ] 6.A.26 가로 스크롤 동작 (모바일)

### 6.B 신규 등록 폼

- [ ] 6.B.1 모든 필드 비어있음 → 이름/전화 중 하나 필수 에러
- [ ] 6.B.2 이름_vi 만 → 성공 (basicInfo='핵심' 안됨, '없음')
- [ ] 6.B.3 이름_vi + 전화 → 성공 (basicInfo='핵심')
- [ ] 6.B.4 이름_kr + 전화 → 성공
- [ ] 6.B.5 전화만 → 성공? (refine 조건 통과 — 확인)
- [ ] 6.B.6 이름 공백만 → refine 에러 (trim 후)
- [ ] 6.B.7 코드 자동 발급 CVN+YYMM+001
- [ ] 6.B.8 같은 월에 두 번째 등록 → CVN+YYMM+002
- [ ] 6.B.9 날짜 경계 (월말 23:59 등록 다음날 00:01 등록) → YYMM 기준
- [ ] 6.B.10 code UNIQUE 충돌 → 에러 토스트
- [ ] 6.B.11 birth_year 1900 → 저장
- [ ] 6.B.12 birth_year 2030 → 저장
- [ ] 6.B.13 birth_year 2031 → input min/max 제약 (클라이언트만)
- [ ] 6.B.14 birth_year 문자 → NaN → null 저장
- [ ] 6.B.15 birth_year 음수 → html min 제약
- [ ] 6.B.16 gender 선택 → 저장
- [ ] 6.B.17 gender 미선택 → null
- [ ] 6.B.18 product_type 3가지 각각 저장
- [ ] 6.B.19 is_waiting 토글 off → recontact/memo 필드 숨김
- [ ] 6.B.20 is_waiting 토글 on → 필드 표시
- [ ] 6.B.21 waiting_memo 500자 → 성공
- [ ] 6.B.22 waiting_memo 501자 → 클라이언트 maxLength 제한 (500)
- [ ] 6.B.23 waiting_memo 501자 직접 값 주입 → zod 에러
- [ ] 6.B.24 교육원 선택 → training_class 선택지 필터링
- [ ] 6.B.25 교육원 변경 시 training_class_id reset → null
- [ ] 6.B.26 교육원 매칭 해제 → class도 null
- [ ] 6.B.27 "미매칭" 선택 → null 저장
- [ ] 6.B.28 날짜 필드 빈값 → null 저장
- [ ] 6.B.29 class_end_date < class_start_date → 저장 허용 (DB 제약 없음)
- [ ] 6.B.30 work_end_date < work_start_date → 저장 허용
- [ ] 6.B.31 termination_reason 선택 → 저장
- [ ] 6.B.32 termination_reason "종료 아님" 선택 → null
- [ ] 6.B.33 취소 버튼 → router.back
- [ ] 6.B.34 제출 시 customer_statuses 자동 생성 (트리거)
- [ ] 6.B.35 교육원 매칭하여 생성 → training_center_finding false 유지
- [ ] 6.B.36 요양원 매칭하여 생성 → care_home_finding false 유지
- [ ] 6.B.37 제출 중 pending 시각화

### 6.C 기본 정보 탭 (수정)

- [ ] 6.C.1 정상 로드 (모든 필드 복원)
- [ ] 6.C.2 교육원을 다른 센터로 변경 → class 자동 리셋
- [ ] 6.C.3 교육원 매칭 해제 → training_center_finding 플래그 OFF 자동
- [ ] 6.C.4 요양원 매칭 → care_home_finding 플래그 OFF 자동
- [ ] 6.C.5 저장 성공 → 토스트 + refresh
- [ ] 6.C.6 저장 실패 → 에러 토스트 + 데이터 유지
- [ ] 6.C.7 삭제 다이얼로그 → cancel → 삭제 안 됨
- [ ] 6.C.8 삭제 → 관련 결제/상담/SMS 모두 사라짐 (CASCADE)
- [ ] 6.C.9 삭제 중 pending + 버튼 잠금

### 6.D 진행 단계 탭

- [ ] 6.D.1 현재 단계 뱃지 색상 9종 매핑
- [ ] 6.D.2 각 단계 카드 complete 뱃지 (✓완료 / 진행중)
- [ ] 6.D.3 수동 플래그 9개 각각 토글
- [ ] 6.D.4 플래그 ON/OFF 토스트 표시
- [ ] 6.D.5 Optimistic UI: 클릭 즉시 상태 변경
- [ ] 6.D.6 서버 실패 시 롤백 (이전 값 복원)
- [ ] 6.D.7 자동 필드 Lock 아이콘 + 수정 불가
- [ ] 6.D.8 intake_abandoned=true → currentStage="종료"
- [ ] 6.D.9 study_abroad=true → currentStage="종료"
- [ ] 6.D.10 training_dropped=true → currentStage="종료"
- [ ] 6.D.11 training_reservation_abandoned=true → 이후 진행 막힘
- [ ] 6.D.12 welcome_pack_abandoned=true → 취업 complete 차단 (웰컴팩 대상자만)
- [ ] 6.D.13 care_home_finding=true → "요양원 발굴 중" 라벨
- [ ] 6.D.14 certificate_acquired=true → currentStage="취업중"
- [ ] 6.D.15 interview_passed=true → 취업 단계 전진
- [ ] 6.D.16 수동 플래그 + 자동 매칭 연동:
  - training_center 선택 → training_center_finding 자동 false
  - care_home 선택 → care_home_finding 자동 false
- [ ] 6.D.17 여러 플래그 동시 토글 (race)

### 6.E 상담 일지 탭

- [ ] 6.E.1 교육원/요양원 탭 전환
- [ ] 6.E.2 베트남어만 입력 → 저장 성공
- [ ] 6.E.3 한국어만 입력 → 저장 성공
- [ ] 6.E.4 둘 다 입력 → 저장 성공
- [ ] 6.E.5 빈 내용 저장 시도 → 에러 토스트 (저장 안 됨)
- [ ] 6.E.6 베트남어 입력 → AI 번역 버튼 → 한국어 채움
- [ ] 6.E.7 번역 버튼: 베트남어 공란 → 버튼 disabled
- [ ] 6.E.8 번역 API 에러 (404/500) → 에러 토스트 + description
- [ ] 6.E.9 번역 API 네트워크 에러 → catch
- [ ] 6.E.10 번역 중 loading 표시
- [ ] 6.E.11 API key 없음 → 500 에러 + 명확한 메시지
- [ ] 6.E.12 긴 텍스트 (2000자) 번역 → 성공
- [ ] 6.E.13 특수문자/이모지 번역
- [ ] 6.E.14 저장 후 vi/kr 필드 비워짐
- [ ] 6.E.15 이력 시간 역순 (최신 위)
- [ ] 6.E.16 원문 보기 토글 펼침/접힘
- [ ] 6.E.17 여러 상담 누적 표시
- [ ] 6.E.18 author_id 세팅 (현재 로그인 사용자)
- [ ] 6.E.19 상담 삭제 불가 (UI 없음)
- [ ] 6.E.20 whitespace-pre-wrap 개행 보존

### 6.F 정산 탭

(별도 섹션 7 참조)

---

## 7. 정산 (고객 정산 탭 + /settlements)

### 7.A 정산 요약 (4종 뱃지)

- [ ] 7.A.1 예약금: payment_date 있음 → 완료
- [ ] 7.A.2 예약금: payment_date null → 미완료
- [ ] 7.A.3 예약금: 복수 레코드 중 하나만 payment → 완료
- [ ] 7.A.4 소개비: 레코드 없음 → 미완료
- [ ] 7.A.5 소개비: 1건 pending → 미완료
- [ ] 7.A.6 소개비: 복수 중 하나만 completed → 미완료 (전부 완료해야)
- [ ] 7.A.7 소개비: 전부 completed → 완료
- [ ] 7.A.8 이벤트: 레코드 없음 → 대상아님
- [ ] 7.A.9 이벤트: 전부 gift_given → 완료
- [ ] 7.A.10 이벤트: 일부 미지급 → 미완료
- [ ] 7.A.11 웰컴팩: product_type='교육' → 대상아님
- [ ] 7.A.12 웰컴팩: product_type=null → 대상아님
- [ ] 7.A.13 웰컴팩: 웰컴팩 상품 + 레코드 없음 → 미완료
- [ ] 7.A.14 웰컴팩: sales_reported=false → 미완료
- [ ] 7.A.15 웰컴팩: sales_reported=true → 완료

### 7.B 예약 결제

- [ ] 7.B.1 추가: 금액 35000, 입금일 → 성공
- [ ] 7.B.2 금액 0 입력 → 저장 (허용)
- [ ] 7.B.3 금액 음수 입력 → positiveInt 스키마로 0으로 클램프
- [ ] 7.B.4 금액 "1,200,000" 콤마 → 저장 시 1200000
- [ ] 7.B.5 입금일 없이 추가 → payment_date null
- [ ] 7.B.6 환불 사유 4종 각각 선택 변경 → onBlur 저장
- [ ] 7.B.7 환불 사유 "환불 없음" → null 저장
- [ ] 7.B.8 환불 금액 onBlur 저장, 동일값이면 skip
- [ ] 7.B.9 환불일 onBlur 저장
- [ ] 7.B.10 삭제 → refresh
- [ ] 7.B.11 삭제 중 loading spinner
- [ ] 7.B.12 '소개비_공제' 선택 시 소개비 공제 추천액에 반영
- [ ] 7.B.13 100,000원 (웰컴팩 예약) → 공제 대상 아님 (로직 검증)

### 7.C 소개비

- [ ] 7.C.1 추가: 교육원 미선택 → 에러
- [ ] 7.C.2 추가: 교육원 선택 + 총액 → 자동 계산
- [ ] 7.C.3 총액 - 공제 = 수령액 자동
- [ ] 7.C.4 추천 공제액 (reservation_payments 의 소개비_공제) 자동 표시
- [ ] 7.C.5 세금계산서 Switch 토글
- [ ] 7.C.6 입금일 + 세금계산서일 모두 채워짐 → status=completed 자동
- [ ] 7.C.7 이미 completed 인 레코드는 수정해도 status 유지
- [ ] 7.C.8 삭제
- [ ] 7.C.9 교육원 없는 레코드 (orphan) 표시

### 7.D 이벤트

- [ ] 7.D.1 종류 드롭다운 (system_settings.event_types 반영)
- [ ] 7.D.2 상품권 드롭다운 (system_settings.gift_types)
- [ ] 7.D.3 일반 이벤트 추가
- [ ] 7.D.4 친구 소개 선택 시 친구 Select 노출
- [ ] 7.D.5 친구 미선택 + 친구 소개 → 일반 이벤트로 처리 (현 로직 확인)
- [ ] 7.D.6 친구 = 본인 → 에러
- [ ] 7.D.7 친구 소개 → 양방향 레코드 2건
- [ ] 7.D.8 이미 같은 친구 소개 있으면 중복 에러
- [ ] 7.D.9 친구 고객 자동 리스트에서 본인 제외
- [ ] 7.D.10 삭제 → 한쪽만 삭제되면 다른 쪽은 남음 (확인)

### 7.E 웰컴팩

- [ ] 7.E.1 product_type='교육' → 카드 비활성
- [ ] 7.E.2 product_type='웰컴팩' → 활성
- [ ] 7.E.3 product_type='교육+웰컴팩' → 활성
- [ ] 7.E.4 정가 변경 → final 실시간 계산
- [ ] 7.E.5 할인 변경 → final 재계산
- [ ] 7.E.6 최종 결제액 = total - discount
- [ ] 7.E.7 1회차 예약 100000 + 2회차 300000 → 잔금 자동 계산
- [ ] 7.E.8 지역 추천: 서울 → 250000
- [ ] 7.E.9 지역 추천: 대전 → 300000
- [ ] 7.E.10 지역 추천: 부산 → 350000
- [ ] 7.E.11 지역 매핑 안 됨 → null, 수동 선택
- [ ] 7.E.12 "적용" 버튼 → 추천액 반영
- [ ] 7.E.13 잔금1 셀렉트 4가지 옵션 (0/250k/300k/350k)
- [ ] 7.E.14 매출 보고 Switch + 일자
- [ ] 7.E.15 저장 → upsert (customer_id unique)
- [ ] 7.E.16 음수 결과 0 클램프
- [ ] 7.E.17 discount > total → final=0, balance=0

### 7.F /settlements 페이지

- [ ] 7.F.1 월 선택 기본값 = 이번 달
- [ ] 7.F.2 월 변경 → 해당 달 대상 재조회
- [ ] 7.F.3 주간반 고객: class_start + 45일 포함 월 매칭
- [ ] 7.F.4 야간반 고객: + 75일 포함 월
- [ ] 7.F.5 경계: 3월 17일 주간 + 45일 = 5월 1일 → 5월
- [ ] 7.F.6 이번 달 대상 0명 → 빈 상태
- [ ] 7.F.7 status='completed' 는 대상에서 제외? (확인 — 로직상 포함됨. 의도? 스펙 §6.7.2)
- [ ] 7.F.8 교육생별 뷰: 검색
- [ ] 7.F.9 교육생별 뷰: 4종 뱃지 렌더
- [ ] 7.F.10 교육생별 뷰: 100행 제한 + 안내
- [ ] 7.F.11 교육원별 뷰: 교육원 미선택 시 안내
- [ ] 7.F.12 교육원별 뷰: 선택 후 소속 교육생 표시
- [ ] 7.F.13 뷰 탭 URL 파라미터 유지
- [ ] 7.F.14 월 파라미터 XSS ('?month=<script>') 차단 (parseInt)

---

## 8. 알림발송 (/sms)

### 8.A 랜딩

- [ ] 8.A.1 2개 진입 카드
- [ ] 8.A.2 최근 발송 이력 20건
- [ ] 8.A.3 이력: 타입 뱃지 + 대상 + 미리보기
- [ ] 8.A.4 0건일 때 빈 상태

### 8.B 신규 교육생 알림

- [ ] 8.B.1 교육원별 그룹 표시
- [ ] 8.B.2 미발송 학생 수 강조
- [ ] 8.B.3 체크박스 기본 모두 선택
- [ ] 8.B.4 체크박스 해제 → 메시지 재계산
- [ ] 8.B.5 미리보기 모달 = 최종 메시지
- [ ] 8.B.6 교육원 전화 없음 → "전화번호 없음" + 발송 차단
- [ ] 8.B.7 선택 0명 → 발송 버튼 비활성
- [ ] 8.B.8 발송 성공 → 토스트 + refresh
- [ ] 8.B.9 이미 발송 이력 있는 학생 → "발송 완료 N명 보기" 접이식
- [ ] 8.B.10 NHN 환경변수 미설정 → 에러 토스트
- [ ] 8.B.11 NHN API 에러 (invalid phone) → 에러 표시
- [ ] 8.B.12 메모 입력 → localStorage 저장
- [ ] 8.B.13 다음 번 방문 시 메모 복원
- [ ] 8.B.14 발송 후 sms_messages 1(center) + N(customers) rows

### 8.C 수수료 정산 알림

- [ ] 8.C.1 월 선택
- [ ] 8.C.2 이번 달 미정산 소개비만 표시
- [ ] 8.C.3 교육원별 그룹
- [ ] 8.C.4 소계 = 선택된 항목 합
- [ ] 8.C.5 체크박스 해제 → 소계 재계산
- [ ] 8.C.6 미리보기 = 메시지 최종본
- [ ] 8.C.7 발송 → status=notified 승격 (completed 는 유지)
- [ ] 8.C.8 발송 중 pending
- [ ] 8.C.9 빈 상태 (미정산 0개)

### 8.D /api/sms/send

- [ ] 8.D.1 미인증 → 401
- [ ] 8.D.2 phone 누락 → 400
- [ ] 8.D.3 body 누락 → 400
- [ ] 8.D.4 message_type 누락 → 400
- [ ] 8.D.5 phone 정규화 (하이픈 제거)
- [ ] 8.D.6 잘못된 phone 포맷 ('abc') → 400
- [ ] 8.D.7 body 2001자 → 400
- [ ] 8.D.8 body 2000자 → 성공
- [ ] 8.D.9 NHN 응답 isSuccessful=false → 502
- [ ] 8.D.10 sms_messages insert 실패 시 warning 반환

---

## 9. 설정 (/settings)

### 9.A 결제 설정

- [ ] 9.A.1 숫자 필드 7종 각각 렌더
- [ ] 9.A.2 값 변경 시 저장 버튼 dirty 표시
- [ ] 9.A.3 저장 → 토스트 + refresh
- [ ] 9.A.4 변경 없이 저장 버튼 비활성
- [ ] 9.A.5 commission_rate 0.25 → 0.3 변경 저장
- [ ] 9.A.6 음수 입력 → 저장은 되지만 UI 검증 없음
- [ ] 9.A.7 배열 설정: welcome_pack_interim_options 추가/삭제
- [ ] 9.A.8 배열 설정: event_types 추가/삭제
- [ ] 9.A.9 중복 항목 허용 (제약 없음)
- [ ] 9.A.10 빈 문자열 추가 시도 → 무시
- [ ] 9.A.11 배열 저장 후 dirty 초기화

### 9.B 계정 관리

- [ ] 9.B.1 목록 로드 (service_role 사용)
- [ ] 9.B.2 본인 뱃지 표시
- [ ] 9.B.3 마지막 로그인 시각
- [ ] 9.B.4 활성/비활성 뱃지
- [ ] 9.B.5 계정 생성: 이메일 + 비번 6자
- [ ] 9.B.6 계정 생성: 이메일 중복 → 에러
- [ ] 9.B.7 계정 생성: 비번 5자 → 에러
- [ ] 9.B.8 계정 생성: email_confirm=true 이므로 바로 로그인 가능
- [ ] 9.B.9 본인 비번 변경: 6자 미만 → 에러
- [ ] 9.B.10 본인 비번 변경: 확인 불일치 → 에러
- [ ] 9.B.11 본인 비번 변경: 성공
- [ ] 9.B.12 타인 비활성화 → banned 상태
- [ ] 9.B.13 타인 활성화 → 해제
- [ ] 9.B.14 본인 비활성화 시도 → 에러
- [ ] 9.B.15 service_role 키 오류 시 경고 카드 대체 렌더

---

## 10. 대시보드 (/)

### 10.A 처리 작업 카드

- [ ] 10.A.1 8종 카드 렌더
- [ ] 10.A.2 카드 클릭 → /customers 이동
- [ ] 10.A.3 각 버킷 정확 필터링 (종료/드랍/대기 제외 등)
- [ ] 10.A.4 상위 3명 미리보기 + "외 N명"
- [ ] 10.A.5 0명 버킷도 렌더 (숨기지 않음)

### 10.B 단계 분포 도넛

- [ ] 10.B.1 Recharts PieChart 렌더
- [ ] 10.B.2 Legend 표시
- [ ] 10.B.3 Tooltip (값 N명)
- [ ] 10.B.4 비율 합 = 100%
- [ ] 10.B.5 단계 없음 → 빈 상태
- [ ] 10.B.6 컬러 매핑 정확

### 10.C 신규 고객 카드

- [ ] 10.C.1 daily/weekly/monthly 정확 계산
- [ ] 10.C.2 경계: 24h 기준 00:00 근처 집계
- [ ] 10.C.3 잘못된 created_at 은 무시

---

## 11. 공통 UI/UX

### 11.A 토스트

- [ ] 11.A.1 성공 토스트 녹색
- [ ] 11.A.2 에러 토스트 빨강
- [ ] 11.A.3 위치: top-right
- [ ] 11.A.4 자동 사라짐
- [ ] 11.A.5 description 포함

### 11.B 로딩/Pending

- [ ] 11.B.1 폼 제출 중 spinner + 버튼 비활성
- [ ] 11.B.2 navigating 중 Next.js loading.tsx (없으므로 미적용)
- [ ] 11.B.3 첫 번째 방문 시 Turbopack 컴파일 지연 (dev 전용)

### 11.C 반응형

- [ ] 11.C.1 1280px+ 데스크톱 기본 레이아웃
- [ ] 11.C.2 768px 이하 사이드바 숨김 (`md:flex`)
- [ ] 11.C.3 모바일 가로 스크롤 (테이블)
- [ ] 11.C.4 폼 sm:grid-cols-2 → lg:grid-cols-3

### 11.D 접근성

- [ ] 11.D.1 Label-Input 연결 (htmlFor/id)
- [ ] 11.D.2 aria-invalid on 에러
- [ ] 11.D.3 aria-describedby on FormMessage
- [ ] 11.D.4 버튼 type="submit"/"button" 명시
- [ ] 11.D.5 키보드 네비게이션 (Tab)
- [ ] 11.D.6 focus-visible 링 표시

### 11.E 하이드레이션

- [ ] 11.E.1 <p> 안에 <div> 없음
- [ ] 11.E.2 <button> 안에 <button> 없음
- [ ] 11.E.3 서버와 클라이언트 마크업 일치

### 11.F 이미지/폰트

- [ ] 11.F.1 glocare 로고 aspect-ratio 유지 (width/height 비율)
- [ ] 11.F.2 Pretendard 폰트 로드
- [ ] 11.F.3 Next Image priority 설정

---

## 12. 보안 감사

- [ ] 12.1 XSS: 이름/메모/주소 `<script>` 입력 → React 자동 이스케이프
- [ ] 12.2 XSS: 상담 내용에 HTML → `<pre>` 안이라 안전
- [ ] 12.3 XSS: formatDate 출력 안전
- [ ] 12.4 SQL Injection: Supabase 자동 방어 (파라미터화)
- [ ] 12.5 SQL Injection: .or() 내 특수문자 sanitize
- [ ] 12.6 CSRF: Supabase 쿠키 samesite 기본 설정
- [ ] 12.7 Authz: 다른 사용자가 내 상담 삭제? (현재 삭제 UI 없어서 N/A)
- [ ] 12.8 Authz: Server Action 에서 auth 검증 (하나라도 빠진 곳 있으면 취약)
- [ ] 12.9 Rate limiting: Supabase Auth 기본 제공
- [ ] 12.10 Secret 노출: NHN/Google key 서버 전용 (env 변수명 NEXT_PUBLIC 접두사 아님)
- [ ] 12.11 Open redirect: login redirect 검증
- [ ] 12.12 Service role 사용 route 제한 (API Route + Server Component 만)
- [ ] 12.13 민감 데이터 로그 출력 없음

---

## 13. 동시성/Race

- [ ] 13.1 같은 code로 두 고객 동시 등록 → UNIQUE 제약으로 하나 실패
- [ ] 13.2 progress tab 빠른 연속 토글 → 마지막 값 일관성
- [ ] 13.3 결제 onBlur 저장 연속 호출 → 최신 값 저장
- [ ] 13.4 상담 추가 중 페이지 이탈 → 데이터 손실 (Next.js pending 무시)

---

## 14. 데이터 무결성 (cascade / orphan)

- [ ] 14.1 교육원 삭제 → 소속 classes 삭제
- [ ] 14.2 교육원 삭제 → 소속 customers.training_center_id = null
- [ ] 14.3 교육원 삭제 → customer 의 training_class_id 도 함께 null 되는지 (FK cascade 체인?)
- [ ] 14.4 training_class 삭제 → customers.training_class_id = null
- [ ] 14.5 요양원 삭제 → customers.care_home_id = null
- [ ] 14.6 고객 삭제 → friend_customer_id 가 SET NULL 되는지
- [ ] 14.7 고객 삭제 → SMS 타겟 null 처리

---

## 15. 성능 (가벼운 점검)

- [ ] 15.1 /customers 50행 로드 < 1초 (로컬)
- [ ] 15.2 /settlements 전체 고객 로드 N+1 없음
- [ ] 15.3 dashboard 병렬 fetch (Promise.all)
- [ ] 15.4 useMemo 사용처 의존성 정확

---

## 16. 문서/DX

- [ ] 16.1 README 최신
- [ ] 16.2 .env.local.example 템플릿 존재
- [ ] 16.3 dev server startup < 10s
- [ ] 16.4 hot reload 동작
- [ ] 16.5 Supabase 마이그레이션 파일 넘버링 순차

---

## 결과 요약 (2026-04-22)

### 자동 검증 결과
- ✅ TypeScript `tsc --noEmit` 에러 0
- ✅ Vitest 93개 전부 통과 (customer-status 38 · settlement 26 · sms-templates 7 · dashboard 10 · format 12)
- ✅ `next build` 프로덕션 빌드 성공 (16 routes)
- ✅ DB 교차검증 `qa-verify.ts` 51/51 pass (단계·정산·버킷·분포·신규수·DB무결성)

### 이 감사 라운드에서 추가로 발견·수정한 버그

**보안 (Security)**
11. `listAuthUsers()` 가 **auth 체크 없이 service_role 호출** — 미인증 상태로 전체 사용자 목록 유출 가능 → `requireAuth()` 가드 추가 (심각도: HIGH)
12. 모든 Server Actions 에 **명시적 auth 체크 부재** (proxy.ts 1차 방어만 존재) — `require-auth.ts` 헬퍼 + 모든 action 에 적용 (정산, 교육원, 요양원, 고객, 상담, 설정, SMS)
13. SMS body **2000자 초과 시 조용히 잘림** → 명시적 400 에러 반환

**데이터 무결성 (Data Integrity)**
14. `deleteTrainingCenter`: `commission_payments` 과거 이력 있을 때 FK RESTRICT → raw PG 에러 노출 → 사전 count 체크 + 친절한 에러 메시지
15. **Timezone 버그**: `todayStr()`/`formatDate`/`formatDateTime`/`generateCustomerCode`/`/care-homes/[id]` 등 전부 서버 로컬 타임존 사용 → Vercel UTC 에서 KST 사용자에게 하루 어긋남 → 전부 `Asia/Seoul` 고정

**UI/UX (UI)**
16. **친구 소개 선택 후 친구 미선택 상태로 추가** → 친구 없는 일반 이벤트로 저장됨 → 명시적 검증 + 에러 토스트
17. Customer 폼에서 **교육원 Select 동일 값 재선택 시** training_class_id 불필요 리셋
18. **로고 이미지 aspect ratio 경고** (Next/Image) → 2:1 비율에 맞춰 width/height 재조정

### 추가한 테스트
- format.test.ts: 12개 (formatNumber/Currency/Date/DateTime/dash 모든 edge case)
- dashboard.test.ts: 2개 (대기중 제외, 근무중 제외)
- customer-status.test.ts: 2개 (자체취업 · 웰컴팩 대상 판정)
- qa-verify.ts DB 무결성 섹션: 8개 (trigger 동작, orphan, generated column, 친구소개 양방향, refund 한도)

### 누적 발견·수정 버그 개수
- v1 QA: 10개
- v2 감사: 8개 추가
- **총 18개 이상**

### 수동 브라우저 테스트 필요 항목
인터랙티브 UI 는 실제 브라우저에서 확인 필요. 주요 시나리오:

**로그인/세션**
- 올바른/틀린 이메일·비밀번호 토스트
- redirect 파라미터 내부 경로만 허용
- 로그아웃

**CRUD 전체 플로우**
- 교육원/요양원/고객 등록·수정·삭제
- 월별 개강 인라인 추가/삭제
- 상담 일지 AI 번역 (Google Translate 키 유효 필요)

**진행 단계**
- 9개 수동 플래그 Switch 토글 + optimistic 롤백
- 플래그 체인 차단 확인

**정산**
- 4종 결제 카드 각각 추가/수정/삭제
- 친구 소개 양방향 등록
- 웰컴팩 3회차 계산 + 지역 추천

**SMS** (NHN 발신번호 심사 완료 후)
- 신규 교육생 / 수수료 정산 2개 플로우
- 미리보기 모달
- 실제 발송 → 이력 기록

**설정**
- 결제 기준값 dirty 감지
- 배열 옵션 추가/삭제
- 계정 생성 / 비번 변경 / 비활성화

**대시보드**
- 작업 카드 8종 + 도넛 차트 + 신규 고객 카드

### 알려진 제약
- **대시보드 작업 카드** 클릭 시 `/customers` 로만 이동 (필터 딥링크 미구현)
- **상담 일지 UI 에 작성자 이름 미표시** (DB 에는 author_id 저장)
- **Server Action rate limiting 미구현** (내부 앱이라 허용)
- **CSV/Excel export 미구현** (Supabase 대시보드 사용)
- **audit 로그** 없음 (Supabase realtime 로 대체 가능)
