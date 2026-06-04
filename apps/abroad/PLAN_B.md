# 글로케어 유학 플랫폼 — Plan B (B2B 유학센터 SaaS)

> **변경 배경**: 2026-05-15 기준 비즈니스 모델 피벗. 학생 직접 대면(Plan A)에서 **유학센터(베트남 현지) 대상 B2B SaaS** 로 전환.
>
> **이 문서의 역할**: Plan B 의 단일 진실원(SSoT). 이전 문서들(PRD.md = Plan A 베이스, SESSION_HANDOFF.md = 2주 전 결정사항, ../glocare_customer_management/.../study_abroad_planning_v2.md)은 참고용으로 유지하되, **충돌 시 본 문서 우선**.
>
> **개발 시작점**: `glocare_homepage_abroad` 기존 라이브 사이트 위에 기능 추가하는 방식.

---

## 0. TL;DR

- **무엇**: 베트남 유학센터가 자기 학생의 한국 대학 입학 서류를 온라인으로 제출·검토받고, 대학별 모집요강 일정에 맞춘 학생별 타임테이블을 받는 B2B 플랫폼
- **누가**: 유학센터 담당자 (1차 사용자) + 글로케어 관리자 (백오피스)
- **학생**: 시스템에 로그인하지 않음. 메타데이터로만 존재. 모든 소통은 유학센터 ↔ 글로케어
- **핵심 자산**: 대학×학과별 **모집요강 전산화 데이터** (서류·자격·일정·학비·장학금)
- **결제**: **외부 송금(B2B) + 정산 매칭만** — 온라인 결제 없음
- **개발 규모**: Plan A 의 1/3. **9-12주 총합**

---

## 1. Plan A 대비 핵심 변화 (변경 사항 일람)

### 빠지는 것 (Plan A 가정 사항)
- ❌ 학생 회원가입 / 로그인 / SNS Auth (Google·Facebook·Apple)
- ❌ 학생 직접 결제 → **VND, 2C2P, PayOS 등 베트남 PG 전부 불필요**
- ❌ 학생용 SMS/Zalo OTP
- ❌ 학생 자기진단 위저드 (셀프 분류)
- ❌ 어필리에이트 브로커 코드·티어·SKU 매트릭스
- ❌ 어카운트 헬퍼 / 위임장 / 본인인증 (셀카+여권)
- ❌ AI 원서 자동 생성 (AI 책임 ↑ 우려) → **AI 검토·피드백 도구로 전환**
- ❌ 베트남 송금 (Wise/Payoneer) — B2B 인보이스로 해결
- ❌ 학생 모바일 앱 (푸시알림) — B2B 라 이메일+웹 알림으로 충분
- ❌ 학생 대상 SNS·콘텐츠 마케팅 (B2C) → **B2B 영업으로 전환**

### 새로 들어오는 것
- ✅ 유학센터 회사 계정 + 담당자 multi-user 시스템
- ✅ 유학센터 대시보드 (자기 학생 풀 관리)
- ✅ 학생 일괄 등록 (개별 + 엑셀)
- ✅ **대학별 모집요강 전산화** (AI 추출 + 사람 검수) ← 핵심 자산
- ✅ 학생별 타임테이블 자동 생성 (모집요강 일정 기반)
- ✅ AI 서류 검토 + 피드백 워크플로
- ✅ B2B 인보이스·정산 (외부 송금 매칭)

### 그대로 유지
- ✅ 기존 라이브 사이트 (랜딩, 대학 목록, 사례, 협력센터, 상담 폼, 보험 폼)
- ✅ Supabase + Next.js 16 + Resend + Tailwind 스택
- ✅ 기존 7개 테이블 (universities, departments, study_cases, study_centers, study_contacts, study_insurance_claims, study_channels)
- ✅ 글로케어 본체 디자인 시스템
- ✅ AI = Claude (Sonnet/Haiku) + prompt caching
- ✅ HWP 처리 = PDF 좌표 매핑 (Plan A 의 A안. 모집요강 OCR/추출에 사용)

---

## 2. 용어

| 용어 | 정의 |
|---|---|
| **유학센터 (Center)** | 베트남 현지에서 학생을 자체 관리·모집하는 회사. 본 시스템의 1차 사용자 |
| **유학센터 담당자 (Center User)** | 유학센터에 소속된 직원 계정. 한 센터에 여러 명 |
| **학생 (Student)** | 시스템에 로그인 X. 유학센터가 등록한 메타데이터로만 존재 |
| **모집요강 (Admission Spec)** | 대학×학과별 입학 정보 묶음. 서류 리스트, 자격 조건, 일정, 학비, 장학금 |
| **타임테이블 (Timeline)** | 학생별 자동 생성되는 D-day 일정. 모집요강 마감일·면접일·등록일 등 기반 |
| **검토 (Review)** | 글로케어 관리자가 학생 서류를 모집요강 기준으로 점검하고 피드백 작성 |
| **정산 (Settlement)** | 유학센터가 외부 송금한 금액을 어드민에서 인보이스에 매칭 |

---

## 3. 페르소나

### 3.1 유학센터 담당자 (1차 사용자)
- **소속**: 베트남 현지 유학원 (한국·베트남 법인 무관)
- **언어**: 베트남어 + 한국어 일부 (담당자에 따라 차이)
- **목표**: 자기 학생들 입학 서류를 효율적으로 정리, 마감일 놓치지 않기, 글로케어 피드백 받기
- **사용 환경**: PC 위주 (사무 환경)
- **권한**: 자기 센터의 학생만 조회/관리

### 3.2 글로케어 관리자 (백오피스)
- **역할 분리**: 슈퍼관리자 / 모집요강 담당 / 검토 담당 / 정산 담당
- **언어**: 한국어 (UI)
- **목표**: 유학센터 온보딩, 모집요강 정확하게 입력, 서류 검토 빠르게, 정산 누락 없이
- **사용 환경**: PC

### 3.3 학생 (시스템 외부)
- 시스템에 등록은 되지만 **로그인 X**
- 유학센터 담당자와 오프라인/Zalo 로 소통
- 본인 정보는 유학센터가 등록·관리

---

## 4. 비즈니스 모델

### 4.1 가격 정책

본 단계에서 **가격 모델 미확정**. 어드민에서 유연하게 설정할 수 있도록 데이터 모델 설계.

**고려 중인 패턴**:
- per Student (학생 1명 등록/합격 시 X원)
- 월 구독 (유학센터당 월 Y원, 학생 수 tier)
- 합격 시 등록금 % (성공 보수)
- Hybrid

→ MVP 출시 후 유학센터별 1:1 협상으로 시작 가능. 시스템은 **유연한 가격표 + 인보이스 발행 능력**만 보장.

### 4.2 결제 / 정산 방식

**온라인 결제 없음.** 모든 결제는 외부 송금(은행 이체 또는 국제 송금).

**흐름**:
```
1. 어드민이 유학센터별로 인보이스 발행
   (대상: 학생 N명 / 기간 / 합계 금액)
2. 유학센터가 외부 송금 (글로케어 한국 계좌 또는 베트남 계좌)
3. 어드민이 입금 확인 후 인보이스에 매칭 (수동)
4. 정산 완료 상태로 전환, 영수증/세금계산서 발행
```

**세금계산서**: 한국 법인 발행 (글로케어 측). 유학센터가 한국 법인이면 일반 세금계산서, 베트남 법인이면 외화 매출 인보이스 (영세율 검토).

→ 세무 디테일은 **세무사 자문 필수** (이전 v2 §14 와 동일하지만 단순화됨 — 베트남 학생 직접 결제가 없어지므로).

---

## 5. 사용자 여정

### 5.1 유학센터 담당자 (메인 흐름)

```
[온보딩]
글로케어 영업 컨택 → 계약 → 어드민이 센터 계정 생성·이메일 초대
  ↓
[일상 사용]
1. 로그인 (이메일/비번)
2. 대시보드에서 진행 상황 확인 + 마감 임박 학생 체크
3. 신규 학생 등록 (개별 입력 또는 엑셀 일괄)
4. 학생 상세에서 지원 대학·학과 선택 (모집요강 자동 매칭)
5. 학생 자료 수집 (오프라인) → PDF 로 업로드
6. AI 1차 검토 결과 확인 → 누락/오류 항목 수정
7. 글로케어 검토 요청 → 피드백 받음 → 학생에 전달 → 수정 반복
8. 최종 승인 → 글로케어가 대학에 제출 → 합격 통지
9. 학생 합격 후 등록금/장학금 안내 → 학생에 전달
```

### 5.2 글로케어 관리자

**모집요강 담당자**:
```
1. 대학에서 받은 모집요강 (PDF/HWP) 업로드
2. AI가 데이터 추출 + 표준화 (서류·자격·일정·학비·장학금)
3. 결과 검토 → 수정 → 승인 → 전산화 완료
4. 매년/매학기 갱신
```

**검토 담당자**:
```
1. 검토 큐에서 대기 중인 서류 확인
2. AI 1차 검토 결과 참고
3. 사람 검수 + 피드백 작성
4. 반려(수정 요청) 또는 승인
5. 승인 시 대학 제출 가능 상태로 전환
```

**정산 담당자**:
```
1. 월말 또는 정해진 주기에 유학센터별 인보이스 발행
2. 외부 송금 확인 후 매칭
3. 영수증/세금계산서 발행
4. 분석: 센터별 매출, 합격률, 등
```

---

## 6. 기능 요구사항

### 6.1 유학센터 페이지 (`/center/*`, 로그인 후)

**대시보드 `/center/dashboard`**
- 내 학생 N명, 진행 단계별 카드
- 마감 임박 학생 (7일·30일 이내)
- 최근 글로케어 피드백 알림

**학생 관리 `/center/students`**
- 학생 목록 + 검색·필터 (단계·대학·마감일)
- 신규 등록 — 개별 폼 + **엑셀 일괄 업로드** (템플릿 제공)
- 학생 상세 `/center/students/[id]`:
  - 기본 정보
  - 지원 대학·학과 (모집요강 자동 연결)
  - 서류 업로드 영역 (PDF, 드래그앤드롭)
  - AI 1차 검토 결과
  - 글로케어 피드백 히스토리
  - 타임테이블 (D-day)
  - 메모

**모집요강 조회 `/center/admissions`**
- 대학·학과별 모집요강 검색·필터
- 필요 서류 리스트, 자격 조건, 일정, 학비, 장학금
- "이 모집요강에 학생 매칭" 기능

**타임테이블 통합 `/center/timeline`**
- 내 학생 전체의 D-day 통합 캘린더/리스트
- 마감일·면접일·등록일 등 색상별 구분
- 필터 (학생별, 단계별, 대학별)

**계정 `/center/account`**
- 회사 정보, 담당자 추가/제거, 권한
- 결제 내역 (인보이스 + 송금 매칭 상태)

### 6.2 글로케어 어드민 페이지 (기존 어드민에 추가)

본 레포(`glocare_homepage_abroad`) 또는 별도 어드민 레포(`glocare_customer_management`) 중 어느 쪽에 추가할지는 결정 필요.

**유학센터 관리**
- 가입 승인 / 비활성화
- 담당자 권한 관리
- 회사별 가격 정책 설정 (유연한 단가표)

**모집요강 관리** ← 핵심 자산
- 대학·학과 마스터 (기존 universities, departments 활용)
- 학과별 모집요강 입력 UI:
  - PDF/HWP 업로드 → AI 추출 → 사람 검수 → 승인
  - 항목: 필요 서류, 자격 조건, 모집 일정, 학비, 장학금, 면접 형식
- 갱신 이력 관리 (학기별)

**서류 검토 큐**
- 대기 중인 학생 서류 목록 (FIFO 또는 우선순위)
- 검토 인터페이스:
  - PDF 뷰어
  - AI 검토 결과 사이드바
  - 항목별 OK/반려/메모
  - 피드백 작성 (베/한 토글)
- 검토 완료 후 유학센터에 알림 (이메일)

**정산**
- 인보이스 발행 (유학센터 × 기간 × 학생 단위 자동 집계)
- 외부 송금 매칭 (수동 입력 + 첨부 영수증)
- 세금계산서 발행
- 분석: 유학센터별 매출, 합격률, 마감일 준수율

**대시보드 (운영)**
- 검토 대기 건수
- 마감 임박 학생 (모집요강 기준)
- 신규 유학센터 가입
- 정산 대기 인보이스

### 6.3 기존 라이브 사이트 (그대로 유지)
- `/` 홈, `/about`, `/universities`, `/cases`, `/centers`, `/apply` (상담폼), `/insurance` (보험폼)
- 기존 인입 채널은 그대로. 추가 영업/마케팅에 활용
- 단, **유학센터 로그인 진입점** 추가 필요 (헤더 또는 푸터에 "유학센터 로그인" 링크)

### 6.4 학생 (시스템 외)
- 시스템 로그인 없음
- 유학센터 담당자와 오프라인/Zalo 로 소통
- 향후 확장 시 학생용 단순 조회 페이지(읽기 전용) 고려 가능 (Phase 외)

---

## 7. AI 활용 — 2가지 핵심 use case

### 7.1 모집요강 디지털화 (글로케어 측)

**워크플로**:
```
글로케어 관리자: PDF/HWP 모집요강 업로드
  ↓
AI (Claude Sonnet vision): 텍스트 추출 + 구조화
  ↓
표준 스키마로 매핑:
  - 모집 학과
  - 필요 서류 (이름 + 발급처 + 한글/영문 여부)
  - 자격 조건 (TOPIK 등급, 학력 등)
  - 일정 (지원 시작/마감, 면접, 합격발표, 등록)
  - 학비 (입학금, 등록금, 기타)
  - 장학금 (조건 + 금액)
  ↓
관리자: 추출 결과 검토 → 수정 → 승인
  ↓
study_admission_specs 테이블에 저장
```

**모델 선택**: Claude Sonnet (vision) — OCR + 구조화 출력 강점
**Prompt caching**: 스키마 정의는 캐싱 대상

### 7.2 학생 서류 검토 (유학센터 → 글로케어)

**워크플로**:
```
유학센터: 학생 서류 PDF 업로드 (여러 페이지 가능)
  ↓
AI (Claude Sonnet vision): 1차 검토
  - 어떤 모집요강의 어떤 서류인지 식별
  - 누락 항목 체크
  - 형식 오류 체크 (날짜 형식, 서명 누락 등)
  - 학생 정보 vs 학적 정보 일치 여부
  ↓
유학센터: AI 결과 화면 확인 → 수정 가능한 건 수정 → 검토 요청
  ↓
글로케어 검토 담당: 최종 사람 검수
  - AI 결과 검토
  - 추가 피드백 작성
  - OK / 반려
  ↓
유학센터: 피드백 받고 수정 → 재제출 (반복)
```

**모델 선택**: Claude Sonnet (vision)
**책임 분리**: AI 는 1차 필터, **최종 결정은 사람** (책임 한정)

### 7.3 알림 / 일정 노출

타임테이블의 마감일·면접일·등록일을 모집요강 기반으로 자동 계산:
- 유학센터 대시보드에서 **D-day 리스트** 노출
- 7일·30일 임박 시 이메일 알림 (Resend)
- 학생별 / 단계별 / 대학별 필터

**알림 발송 채널**:
- 1차: 이메일 (Resend) — 기존 인프라
- 2차: 인앱 배너 + 모달
- Zalo/SMS 자동 알림은 Plan A 와 동일하게 **베트남 법인 없으면 어려움** → 우선 이메일로만

---

## 8. 데이터 모델

### 8.1 그대로 유지 (기존)
- `universities`, `departments`
- `study_cases`, `study_centers` (마케팅용 협력센터 — 이름만 겹침)
- `study_channels`
- `study_contacts` (일반 상담 인입 — 그대로)
- `study_insurance_claims` (별 도메인 — 그대로)

### 8.2 신규 테이블 (Plan B)

```
study_center_orgs           — 유학센터 회사
├─ id, name_vi, name_ko, country, tax_id, status,
├─ pricing_policy_id, settlement_currency, contact_info
└─ created_at, activated_at, deactivated_at

study_center_users          — 담당자 계정 (1 org : N user)
├─ id, org_id, email, role (admin/user), name, status
└─ Supabase Auth user_id 매핑

study_managed_students      — 유학센터가 등록한 학생
├─ id, org_id, name, dob, passport_no_encrypted,
├─ phone, email (학생 본인, 알림용 비활성),
├─ topik_level, current_visa (D-4/없음/기타),
├─ location (베트남/한국), notes
└─ created_at, updated_at

study_admission_specs       — 모집요강 전산화 (핵심 자산)
├─ id, university_id, department_id, term (학기/년),
├─ required_documents (JSONB: 서류 리스트),
├─ eligibility (JSONB: 자격 조건),
├─ schedule (JSONB: 일정 - 지원/마감/면접/합격/등록),
├─ tuition (JSONB: 학비),
├─ scholarships (JSONB: 장학금),
├─ source_file_url, ai_extraction_log, approved_by, approved_at
└─ status (draft/reviewing/approved/archived)

study_applications          — 학생 지원 (1 학생 : N 지원)
├─ id, student_id, admission_spec_id, status,
├─ created_at, last_review_at, submitted_to_university_at,
├─ accepted_at, enrolled_at, cancelled_at
└─ next_action, next_deadline

study_application_documents — 학생이 제출한 서류
├─ id, application_id, document_type, file_url,
├─ ai_review_result (JSONB), ai_reviewed_at,
├─ human_review_result, human_reviewer_id, human_reviewed_at,
└─ status (pending/ai_done/human_review/approved/rejected)

study_review_feedback       — 검토 피드백 히스토리
├─ id, document_id, reviewer_type (ai/human),
├─ reviewer_id, content_vi, content_ko, severity,
└─ created_at, resolved_at

study_timelines             — 학생별 D-day (자동 생성)
├─ id, application_id, event_type, event_date,
├─ source_spec_field (모집요강의 어느 일정에서 왔는지),
└─ notification_sent_at

study_invoices              — 인보이스 (B2B)
├─ id, org_id, period_start, period_end,
├─ line_items (JSONB: 학생별/서비스별 청구),
├─ total_amount, currency, status (draft/sent/paid/cancelled),
├─ tax_invoice_url (세금계산서),
└─ created_at, sent_at, paid_at

study_settlements           — 송금 매칭
├─ id, invoice_id, amount, currency, received_at,
├─ bank_reference, attached_proof_url, matched_by_admin
└─ note
```

### 8.3 Plan A 에서 폐기되는 테이블 (적용 안 함)
- ~~study_applicants~~ (학생 회원)
- ~~study_brokers~~ (어필리에이트)
- ~~study_broker_product_rates~~ (브로커×SKU)
- ~~study_products~~ (학생용 SKU)
- ~~study_addons~~ (학생용 부가서비스)
- ~~study_payments~~ (학생 직접 결제)
- ~~study_refunds~~ (학생 환불)
- ~~study_form_templates~~ / ~~study_form_instances~~ (AI 원서 자동 생성)
  - → AI 원서 생성 자체가 빠지므로 불필요. 단, 모집요강 추출 시 PDF 좌표 매핑 기술은 활용 가능
- ~~study_notifications_log~~ (학생용 SMS/Zalo)

### 8.4 RLS 정책 핵심

- `study_center_users` 는 자기 org_id 의 학생만 조회 가능
- `study_managed_students.org_id` 가 RLS 기준
- 글로케어 관리자는 별도 role (`admin`) 으로 전체 접근

---

## 9. 정산 로직

```python
# 인보이스 발행 (월별)
def issue_invoice(org_id, period_start, period_end):
    # 1. 해당 기간 동안 해당 org 의 학생 활동 집계
    items = []
    if pricing_policy == 'per_student_enrolled':
        items = students_enrolled_in_period(org_id, period_start, period_end)
    elif pricing_policy == 'monthly_subscription':
        items = [{'desc': '월 구독료', 'amount': subscription_fee}]
    elif pricing_policy == 'percent_of_tuition':
        items = enrollment_fees_in_period(org_id, period_start, period_end)
    # ...
    
    invoice = create_invoice(org_id, items, ...)
    send_email(org_id.contact, invoice)
    return invoice

# 송금 매칭 (수동)
def match_settlement(invoice_id, amount, bank_reference, proof_file):
    settlement = create_settlement(invoice_id, amount, bank_reference, proof_file)
    update_invoice_status(invoice_id, 'paid')
    issue_tax_invoice(invoice_id)
    notify_org_admin(invoice_id)
```

**환불 / 취소**: 학생 직접 결제가 없으므로 환불 규정 매우 단순. 유학센터와 1:1 협상 후 어드민에서 인보이스 정정.

---

## 10. 비기능 요구사항

### 10.1 다국어
- **어드민 (글로케어)**: 한국어
- **유학센터 UI**: **베/한 토글** (담당자에 따라 선택). 기본값 베트남어
- **모집요강 데이터**: 한국어 원문 + 베트남어 번역 (AI 보조 + 사람 검수)

### 10.2 인증
- **유학센터 담당자**: Supabase Auth 이메일/비번. SNS Auth 불필요. 어드민이 초기 계정 생성·이메일 초대
- **글로케어 관리자**: 별도 role
- **MFA**: 어드민만 필수, 유학센터는 선택

### 10.3 보안 / 개인정보
- 학생 여권번호·학적 등 민감정보 암호화
- 한국 PIPA + 베트남 PDPD 준수
- **유학센터가 학생 동의 받음** (위임 처리자 위치). 글로케어는 처리자
- 변호사 자문 시 B2B 처리자-위임자 관계 명확화

### 10.4 성능
- 초기 동시 사용자 = 유학센터 ~10개사 × 담당자 ~3명 = 30 동접 가정
- Phase 후 100 유학센터까지 확장

### 10.5 운영
- 글로케어 관리자 권한 분리: 슈퍼/모집요강/검토/정산
- 감사 로그 (서류 검토 변경, 인보이스 변경, 학생정보 변경)

---

## 11. 마일스톤

> 산정 단위: **AI(Claude) 작업일**. 사용자 검수·결정 라운드는 별도 (비동기). 캘린더 시간은 검수 응답 속도에 따라 +α.

### Phase B1 — 기반 (✅ 완료 2026-05-27)
- ✅ 유학센터 회사·담당자 계정 시스템 (Supabase Auth + Next 16 `proxy.ts` + DAL `verifyCenterSession`)
- ✅ 유학센터 대시보드 + 학생 등록 (개별 + 엑셀 — exceljs 양식 생성 + SheetJS 업로드 파싱)
- ✅ 모집요강 DB 스키마 (spec-schema.ts lock) + 유학센터용 조회 (read-only) + Supabase Studio 직접 시드 2건 (동남보건·서정)
- ✅ 기본 라우트·권한·RLS + `(site)` / `center/(authed)` route group 분리
- ✅ `study_pricing_plans` 스키마 (4모델 유연 표현)
- ✅ 보너스: 지원 의향(study_applications) 등록 UI — 모집요강·학과 동적 매칭
- ⬜ 후속(B1+): 학생 삭제, 지원 편집/삭제, i18n.ts 통합, 실패 행 재다운로드

### Phase B2 — 워크플로 (6-9 작업일)
- **모집요강 AI 자동 추출 + 검수 UI** (PDF/HWP → Claude Sonnet vision → spec-schema 검증 → 운영자 검수 → 승인)
- 학생 서류 업로드 + **AI 1차 검토**
- 글로케어 검토 큐 + 피드백 작성
- 모집요강 ↔ 학생 매칭 + **타임테이블 자동 생성**
- 이메일 알림 (Resend) — 마감 임박, 피드백 도착, 검토 완료

### Phase B3 — 결제/운영 (3-5 작업일)
- 인보이스 발행 + 송금 매칭 UI
- 세금계산서 발행 (기존 회계 시스템 연동 or 수동)
- 분석 대시보드 (센터별 매출, 합격률, 검토 처리 속도)
- 운영자 권한 분리 마무리

### Phase B+ — 후속 (범위 외, 별도 일정)
- **AI 신청서류 자동 작성** (Plan A 핵심, 유학센터 1차 자체 작성 가능하므로 후순위)
- Zalo / SMS 알림
- 모바일 앱 / PWA
- 분석 고도화 (코호트·LTV)

**총합 13-20 작업일** (B1+B2+B3). 사용자 검수 라운드 별도.

---

## 12. 어디서 개발할지 (✅ 확정)

이미 사용 중인 글로케어 내부 어드민을 그대로 확장. 외부(유학센터용)는 본 저장소에 신규 추가.

| 구분 | 저장소 | 배포 | 용도 / UI 언어 |
|---|---|---|---|
| 공개 사이트 | `glocare_homepage_abroad` | 기존 Vercel | 랜딩·`/apply`·`/insurance`·`/universities` 등 — 다국어 (현행 유지) |
| **외부 어드민** (유학센터용, 신규) | `glocare_homepage_abroad` 내 `src/app/center/...` | 동일 Vercel | **베트남어 디폴트**, 별도 인증 경계 (Supabase Auth + RLS) |
| **내부 어드민** (글로케어 운영팀, 기존 확장) | `../glocare_customer_management` | https://glocare-admin.vercel.app/ | **한국어**, 요양보호사·유학생 통합 관리. 가격 plan 설정·인보이스·정산·모집요강 검수 화면 추가 |

DB는 Supabase 단일 인스턴스 공유. study_* 테이블군 신규 추가.

---

## 13. Decision Log

| # | 항목 | 결정 | 상태 |
|---|---|---|---|
| 1 | 사용자 페르소나 | 유학센터 담당자 + 글로케어 관리자 (학생 직접 X) | ✅ 확정 |
| 2 | 결제 방식 | 외부 송금 + 어드민 매칭. 온라인 결제 X | ✅ 확정 |
| 3 | 가격 정책 | 4모델(per_student/monthly/percentage/hybrid) 모두 표현 가능한 `study_pricing_plans` 스키마. 내부 어드민에서 유학센터별 plan 설정 | ✅ 확정 |
| 4 | AI use case | (1) 모집요강 추출 (2) 서류 1차 검토. **신청서류 자동 작성은 B+ 범위로 이관** (유학센터 자체 작성 역량 보유) | ✅ 확정 |
| 5 | UI 언어 (외부 어드민, 유학센터) | 베트남어 디폴트 | ✅ 확정 |
| 6 | UI 언어 (내부 어드민) | 한국어 | ✅ 확정 |
| 7 | 학생 시스템 접근 | 없음 (메타데이터) | ✅ 확정 |
| 8 | 모바일 앱 | 본 Phase 범위 외 (B+) | ✅ 확정 |
| 9 | 어드민 위치 | 내부 = `../glocare_customer_management` 확장 (이미 사용 중, https://glocare-admin.vercel.app/) / 외부 = `glocare_homepage_abroad` 내 `src/app/center/...` 신규 | ✅ 확정 |
| 10 | 모집요강 갱신 주기 | 연 2회 (학기별 — Spring/Fall). `study_admission_specs.term` 으로 표현 | ✅ 확정 |
| 11 | 학생 일괄 업로드 엑셀 양식 | B1-3 작업항목. 기본 컬럼: 이름·생년·여권·연락처·이메일·지원대학·지원학과·메모. 베트남어 헤더 | 🟡 작업항목 |
| 12 | 알림 채널 | 이메일 (Resend). Zalo/SMS 는 B+ | ✅ 확정 |
| 13 | 환불 / 취소 정책 | 1:1 협상 + 인보이스 정정 | ✅ 확정 |
| 14 | 세금계산서 발행 주체 | 글로케어 한국 법인 | ✅ 확정 |
| 15 | 통신판매업 신고 | 불필요 (B2B + 무결제 + 일반소비자 대상 아님). 추가 조치 없음 | ✅ 확정 |
| 16 | 변호사 자문 범위 | PIPA + PDPD + B2B 처리자·위임자 관계 + 모집요강 저작권 | ✅ 확정 |
| 17 | 모집요강 편집 진입점 | **B2 의 AI 자동 추출 + 검수 UI 가 유일한 편집 진입점**. B1 은 조회 only + Supabase Studio 시드. 운영자가 빈 폼 처음부터 채우는 시나리오 X (운영 흐름이 AI→검수→승인 순) | ✅ 확정 |

---

## 14. 참고 / 관계도

- **PRD.md** — Plan A 베이스 비즈니스 모델. **참고용** (구체적 페이지 구조·정산 로직 일부 재사용 가능, 단 학생 직접 부분은 모두 무시)
- **SESSION_HANDOFF.md** — Plan A 시점 결정사항. **대부분 폐기**. AI/HWP 처리 / Supabase 공유 / 한국 법인 운영주체 / 변호사 자문 권장 등은 살아남음
- **`../glocare_customer_management`** (배포: https://glocare-admin.vercel.app/) — **글로케어 내부 어드민. 이미 사용 중**. 본 Plan 의 가격 plan 설정·인보이스·정산·모집요강 검수 화면이 이쪽에 추가됨
- **../glocare_customer_management/.claude/worktrees/determined-kapitsa-eb37f5/docs/study_abroad_planning_v2.md** — 어드민/DB 측 기획서 v2. **대부분 무관 (학생 직접 부분), AI/HWP/Supabase/법무 결정사항만 살아남음**
- **../Glocare_MoHinhKinhDoanh.html** — Plan A 시뮬레이터. **Plan B 에선 사용 안 함**

---

## 15. 다음 액션 (새 세션 진입 시)

1. 본 문서 정독 + 의문점 확인
2. 결정 필요 항목 (Decision Log 의 🟡): 가격 정책, UI 언어, 어드민 위치
3. **Phase B1 기술 명세** 작성:
   - 유학센터 회사·담당자 스키마 + RLS
   - 학생 등록 폼 / 엑셀 템플릿
   - 모집요강 스키마 (JSONB 구조 확정)
   - AI 모집요강 추출 PoC (Claude Sonnet vision + 샘플 PDF)
4. 영업 측 액션: 첫 협력 유학센터 1-2개 인터뷰 (실제 워크플로 확인, 본 기획 검증)
5. 변호사 자문 (B2B 위임자 관계 명확화)
