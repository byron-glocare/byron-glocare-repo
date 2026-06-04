# PoC Step 2 — 필드 inventory 및 정규화 매핑

작성: 2026-05-26 · 입력: [step1_raw/](step1_raw/) 7건 + [step2_document_forms_catalog.md](step2_document_forms_catalog.md)

7건 모집요강(어학연수 1·전문학사 3·학사4년 2·요양보호지정 1) 의 step1 raw JSON 을 비교 분석. **5개 JSONB 카테고리 + 추가 메타데이터** 별 필드 출현률·표현 차이·정규화 룰 도출. step3 에서 zod 스키마로 lock 될 후보.

샘플 ID 표기: `K`=군장 / `Sj`=서정 / `DA`=대구예술 외국인특별 / `DH`=동남보건 / `DI`=대구예술 국제교류 / `Y`=유한 / `M`=명지

---

## 1. 최상위 구조 변경 권고

| 변경 | 이유 |
|---|---|
| **`program_type` 필수 enum 추가** (`language_program` / `associate_2yr` / `bachelor_3yr_extension` / `bachelor_4yr`) | 어학연수(K)와 학위과정(나머지)이 schedule·tuition·eligibility 구조가 다름. 표현 분기 필요 |
| **`departments[]` 배열** (모집요강 row 1건당 N 학과) | DA 11학과, Y 36+학과, DI 6학과, DH 1학과 3트랙. row 분리하면 모집요강·일정 정보 중복 폭증 → 1 row + 학과 배열이 합리적. 단 `study_admission_specs.UNIQUE(university_id, department_id, term)` 정책 폐기/수정 필요 |
| **5개 JSONB 컬럼 유지 + `metadata` JSONB 추가** | living_cost·post_acceptance·forms·government_designation·contacts 등 5 카테고리 밖 정보 표준 보관처 |

---

## 2. `required_documents` 필드 비교

| 문서 키 | K | Sj | DA | DH | DI | Y | M | 출현률 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| application_form | ✔ | ✔ | ✔ | ✔ | — | ✔ | (✔) | 6/7 |
| self_intro / study_plan | ✔ | ✔ | ✔ | ✔ | — | — | (✔) | 4-5/7 |
| photo (3.5×4.5cm 등) | ✔ | ✔ | (✔) | ✔ | — | — | — | 3/7 |
| passport_copy | ✔ | — | ✔ | ✔ | — | (✔) | (✔) | 4-5/7 |
| **highschool_diploma** | ✔ | ✔ | ✔ | ✔ | — | ✔ | ✔ | 6/7 |
| **highschool_transcript** | ✔ | ✔ | ✔ | ✔ | — | ✔ | (✔) | 6/7 |
| family_relations_certificate | ✔ | ✔ | ✔ | ✔ | — | ✔ | (✔) | 6/7 |
| nationality_proof (본인+부모) | ✔ | ✔ | ✔ | ✔ | — | ✔ | (✔) | 6/7 |
| **bank_balance_certificate** | ✔ | — | ✔ | ✔ | — | ✔ | (✔) | 5/7 |
| financial_proof (재직증명 등 부속) | ✔ | — | (✔) | — | — | (✔) | — | 2-3/7 |
| **korean_proof (TOPIK 등)** | — | ✔ | ✔ | ✔ | — | ✔ | ✔ | 5/7 |
| career / license_copy (보건) | — | ✔ | — | — | — | — | — | 1/7 |
| visa_application_form | ✔ | — | — | — | — | — | — | 1/7 |
| privacy_consent | — | (✔) | ✔ | ✔ | — | — | — | 2-3/7 |
| financial_pledge_form | — | — | ✔ | ✔ | — | ✔ | — | 3/7 |
| academic_record_release | — | — | ✔ | — | — | — | — | 1/7 |
| alien_registration_card (국내체류만) | — | — | — | ✔ | — | ✔ | — | 2/7 |

**(✔)** = 본문 텍스트 추출 부족으로 추정.

### 정규화 룰
- `document_type` 은 [step2_document_forms_catalog.md](step2_document_forms_catalog.md) 에 정의된 enum 으로 강제
- 학교 소정 양식 (application_form / self_intro / privacy_consent / financial_pledge_form / academic_record_release) 은 **별도 group="university_form"** 으로 묶음 — 학교가 제공한 양식을 학생이 채우는 형태
- 발급 인증 등급 표현: `notarization: 'apostille' | 'consul' | 'consul_for_vietnam' | 'translation_notarization' | 'none'`
- `language` 표시: `'ko' | 'en' | 'vi' | 'ko_or_en'`

---

## 3. `eligibility` 필드 비교

### 3-1. 국적·신분 카테고리 (베트남 필터 적용 후)

전 학교 공통: **외국인 (지원자 본인 + 부모 양쪽이 베트남 국적)** 으로 단순화됨.
유한대만 추가로 "학생 본인만 외국인" 카테고리 인정 (1순위 카테고리 적용).

### 3-2. 학력 요건

| 학교 | 최소 학력 | 학제 인정 | 비고 |
|---|---|---|---|
| K | 고졸 | 12년 — | 성적 6.8 이상 (베트남 10점 만점 추정) |
| Sj | 고졸 | 베트남 학제 OK | 임시 졸업증명 불가 |
| DA | 고졸 | 12년+ | 한국 고교 시작 전 외국 국적 취득 필수 |
| DH | 고졸 | 정규 고교만 | 검정고시·홈스쿨링·사이버학습·성인교육 불인정 |
| DI | 고졸 | 동등 이상 | 추가 X |
| Y | 고졸 | 12년 | 외국 학교 졸업 |
| M | 고졸 | — | 또는 해외 대학 간호·보건 관련 학과 졸업 |

### 3-3. 한국어 요건 (핵심)

| 학교 | TOPIK 최소 | 대체 경로 |
|---|---|---|
| K | (어학연수) — | 입학 X |
| Sj | 2 | 세종학당 초급2 / KIIP 2단계(41점) / 대학 자체평가 / 보건학위 / 요양 경력 |
| DA | **2 (예체능), 3 (일반), 3 (한국어·복지)** | 자체 한국어시험 / 부설 한국어교육센터 수료. 졸업 전 TOPIK 4(예체능 3) 의무 |
| DH | 3 (일반), **2 (보건·미용·디자인 등)** | 자체 한국어시험 / 세종학당 |
| DI | (리플릿) | 외국인특별전형 모집요강 참조 |
| Y | 2 | 세종학당 초급2 (오프라인만) / KIIP 2단계 |
| M | 2 | (없음 명시) |

**핵심 정규화**: `korean_proficiency.topik_min_default` + `topik_min_by_dept_category` (학과 카테고리별 분기) + `alternative_paths[]` (OR 형 N개). 졸업 전 추가 의무도 별도 필드.

### 3-4. 영어 대체 경로 (DA·DI 만)
- TOEFL PBT 530 / CBT 197 / iBT 71 / IELTS 5.5 / CEFR B2 / TEPS 600 / NEW TEPS 326
- DA 의 국제관광경영학과·한국어·복지학과만 적용
- → `english_proficiency` sub-schema 별도. 학교 전체가 아닌 일부 학과 한정 케이스

### 3-5. 재정 잔고 요건 (KRW 기준)
| 학교 | 잔고 최소 | 명의 | 발급일 기준 |
|---|---|---|---|
| K | 8,000,000 | 본인 또는 가족 | (베트남) |
| Sj | (명시 없음) | — | — |
| DA | 16,000,000 | 본인 또는 부모 | — |
| DH | 20,000,000 | 본인 또는 부모만 | 1개월 내 |
| Y | 20,000,000 | 본인 또는 재정보증인 | 30일 내 |
| M | (텍스트 결락) | — | — |

→ `eligibility.financial_minimum: { amount, currency, holder_relations, freshness_days }`

### 3-6. 배제 조건 (exclusions[])
공통: 복수국적자, 위조·허위 서류, 비자 발급 거부 이력
DI 추가: 한국 불법체류 사촌 이내 가족

---

## 4. `schedule` 필드 비교

### 4-1. 단일 vs 다단계
- K = 단일 (지원 → 1차 마감 → 2차 마감 → 입국 → 학기시작)
- Sj = **3차 모집**
- DA = **2차 모집**
- DH = **3차 모집**
- Y = **수시1·수시2·정시·자율** 4단계
- M = 수시2 + 정시 2단계

**정규화**: `schedule.rounds[]` 배열 필수. 각 round 안에 `application_open/close`, `document_close`, `interview`, `result_announcement`, `payment_period`, `visa_certificate_issuance` 등 nullable 필드.

### 4-2. 단일 학기 vs 학사일정 전체
- DI = 봄·여름·가을·겨울 4학기 전체 캘린더 제공 (어학당) — `schedule.academic_calendar` 별도 sub-field

### 4-3. 핵심 일자 표준화
- 모든 날짜 ISO `YYYY-MM-DD`
- 기간은 `[start, end]` 튜플
- 시간 명시는 별도 (`application_close_time: "21:00"` — M)

---

## 5. `tuition` 필드 비교

### 5-1. 단위 다양
- 학기당 (Sj·DA·DH·Y·M) — 가장 일반
- 연 4학기 (K) — 어학연수
- 연 단위 + 생활비 별도 (DI)

→ `tuition.unit: 'per_semester' | 'per_year' | 'per_program'` enum 도입

### 5-2. 학과 카테고리별 차등
- DA: 애니웹툰 4,299,000 / 예체능 4,330,000 / 국제 3,703,000
- DH: 사회실무 3,182,600 / 보건 3,477,600 / 간호 3,552,800
- Y: 공학·예체능 3,530,000 / 자연과학(군) 3,619,000 ~ 3,723,000 / 인문사회(군) 3,191,000 ~ 3,282,000

→ `tuition.tuition_by_faculty: Record<string, number>` (학부/계열명 → 금액) 또는 학과별 row 분리 + 각 row 의 단일 tuition 값

### 5-3. 공개 시점
- Sj = `pending_until_acceptance` (합격자 발표 시 안내)
- 나머지 = 본문 명시

→ `tuition.disclosure_state: 'disclosed' | 'pending_until_acceptance'`

### 5-4. 추가 비용 (의무·선택)
- 전형료: K — / Sj — / DA 0 / DH 35,000 / DI 50,000 / Y — / M —
- 보험료: DI 100,000원/년 — 그 외 학교는 별도 항목
- 기숙사: K 900,000(6개월) / Sj — / DI 1,770,000(6개월) / 등

→ `tuition.application_fee` + `tuition.other_fees[]` 유지. `living_cost` 별도 객체

---

## 6. `scholarships` 필드 비교

### 6-1. 신입생 입학장학금 패턴

| 패턴 | 학교 | 표현 |
|---|---|---|
| **TOPIK 등급별 stepped %** | Y | 3급 30% / 4급 40% / 5급 50% / 6급 60% |
| **TOPIK 그룹별 stepped %** | DA | 3-6급 50% / 2급 40% |
| **TOPIK + 자격조건별 정액** | Sj | 외국인요양보호 80만 / 어학중급 50만 / 어학고급 100만 |
| **수업료 일괄 정률** | DH | 20% (TOPIK 등급은 별도 가감) |
| 명시 없음 | K, M | — |

**정규화**: `benefit_type: 'tuition_pct' | 'tuition_amount' | 'admission_fee_waiver' | 'stipend' | 'other'` + **`tiered_by_topik`** sub-schema 도입 (등급→값 매트릭스).

### 6-2. 재학생 장학금 패턴
- Y: TOPIK 등급별 stepped (신입생과 동일 구조 + 학점·평점 조건)
- Sj: 성적장학·요양보호사장학 등 5종
- DA: 최대 30%, 취득학점·평점·TOPIK 종합
- DH: 직전학기 성적 차등 (장학위원회 규정)

→ `scholarships[i].applies_to: 'freshman' | 'enrolled' | 'both'` enum

### 6-3. 중복 제한
- Sj: 어학장학 ↔ 지역정주 동반가족 (베트남 필터 후 후자 제거됨), 어학장학 ↔ 성적장학·요양보호사장학

→ `scholarships[i].exclusivity_with: string[]` (다른 장학금 name 목록)

### 6-4. 정부 정책 혜택 (장학금과 별개)
- M: 법무부·보건복지부 지정 → 비자 재정요건 완화, 체류 연장 요건 완화, E-7 비자 가능, 최저임금 보장

→ **별도 sub-schema** `metadata.government_designations[]` 필요. 학교 자체 장학금과 분리 표현.

---

## 7. 추가 메타데이터 (기존 5 카테고리 밖)

PoC 진행 중 일관되게 발견된 정보군:

### 7-1. `metadata.selection_process`
- DH: 한국어평가 50% + 면접 50%, 200점 만점, 컷오프 150
- DA: 서류전형 100%, 60점 컷오프
- Sj: 서류 + 면접 (단계별)
- → `score_breakdown: { component: weight_pct }` + `pass_threshold` + `interview_required`

### 7-2. `metadata.post_acceptance`
- visa_type, vn_specific_visa_documents (베트남 한국대사관용), insurance_requirement, warnings

### 7-3. `metadata.living_cost` (DI 만 상세, 다른 학교 부분)
- dorm_fee + dorm_deposit + pickup_fee + telecom + textbook
- → optional sub-schema

### 7-4. `metadata.forms` (학교 소정 양식 카탈로그)
- K·Sj·DA·DH 다 보유. enum: `application_form / self_intro / study_plan / financial_pledge / privacy_consent / academic_record_release`

### 7-5. `metadata.contacts`
- email / phone / address / website / online_apply_url

### 7-6. `metadata.government_designation` (M 만 해당)
- agency: 'mojusticeplus' (법무부+복지부) 같은 enum
- benefits: ['relaxed_visa_financial', 'relaxed_stay_extension', 'e7_eligible', 'min_wage_guaranteed']
- effective_from: 날짜

### 7-7. `metadata.glocare_relevance` (글로케어 운영 메모)
- target_score: 학과·트랙별 글로케어 ICP 적합도 (예: 요양보호 = 10/10, 미술 = 3/10)
- 어드민에서 운영자가 수동 라벨링 — AI 추출 X

---

## 8. 베트남 필터 적용의 일관된 결과

7건 모두에서 다음 정보가 베트남 필터로 **삭제**됨:
- 우즈벡·중국·일본·기타 국가 전용 (KDB은행 잔고, chsi.com.cn 학력인증, 호구부, 호적등본 등)
- F-4(재외동포)·F-1·F-3·E-7 비자 소지자 우대
- 결혼이주민·북한이탈주민·재외국민 카테고리
- 한국 학적자의 외국 학교 전입 경로

**일관 보존**:
- 베트남 = 아포스티유 미가입국 → 주베트남 한국영사 또는 주한 베트남공관 영사확인 룰
- 베트남 비자 신청 시 "지급유보방식 유학경비 잔고 증명서" 추가
- 베트남 가족관계 = 출생증명서 + 호적등본 (DH 명시)

→ `metadata.country_specific_notes_vi` 컬럼 단일화 (자유 텍스트 + 구조화 일부)

---

## 9. step3 권장 spec_data 구조 (요약)

```ts
admissionSpecDataSchema = {
  // 1) 신원
  identity: { university_name_ko, program_type, term, ... },
  // 2) 학과·트랙 (multi)
  departments: [{ faculty, name, years, ... }],
  // 3) PLAN_B §8.2 의 5개 JSONB 영역 (기존)
  required_documents: [{ key, name_ko, required, notarization, ... }],
  eligibility: { applicant_categories, education, financial_minimum, korean_proficiency: { topik_min, alternative_paths }, english_proficiency?, exclusions },
  schedule: { rounds: [...], academic_calendar?, semester_start },
  tuition: { unit, by_faculty, application_fee, other_fees, disclosure_state, refund_policy, payment_method },
  scholarships: [{ name, applies_to, benefit_type, benefit_value, tiered_by_topik?, exclusivity_with }],
  // 4) 추가 메타 (신규)
  metadata: {
    selection_process: { score_breakdown, pass_threshold, interview_required, ... },
    post_acceptance: { visa_type, vn_specific_visa_documents, warnings, insurance_requirement },
    living_cost?: { dorm_fee, dorm_deposit, pickup_fee, telecom, textbook, total },
    forms?: { application_form, self_intro, ... },
    contacts: { phone, email, address, website, online_apply_url },
    government_designations?: [{ agency, benefits, effective_from }],
    country_specific_notes_vi?: string,
    glocare_relevance?: { target_score, manual_notes }
  }
}
```

**`study_admission_specs` SQL 변경 권고** (step3 결과 → B1_schema.sql 갱신):
- `department_id` → `departments` JSONB 로 이전, `department_id` 컬럼 제거 + `UNIQUE(university_id, department_id, term)` 제약 폐기 + `UNIQUE(university_id, term, source_file_hash)` 같은 새 제약
- 5개 JSONB 컬럼 유지 + `metadata` JSONB 컬럼 1개 신규
- 또는: `spec_data` 단일 JSONB 컬럼으로 묶고 5개를 sub-property 로 이동 (스키마 단순화)

→ 둘 중 선택은 사용자 결정 (step3 진입 전).

---

## 10. step3 진입 전 사용자 확인 필요 항목

| # | 항목 | 옵션 |
|---|---|---|
| S3-1 | `study_admission_specs` 컬럼 구조 | (a) 5 JSONB + 1 metadata JSONB / (b) 단일 spec_data JSONB / (c) 5 JSONB 유지 + 신규 컬럼들 |
| S3-2 | multi-department 표현 | (a) 모집요강 1 row + departments[] JSONB (권장) / (b) row 분리 + 모집요강 메타 중복 / (c) parent_spec_id 그루핑 |
| S3-3 | `glocare_relevance` 운영자 라벨링 도입 여부 | (a) B1 에 포함 (b) B+ 후속 |
| S3-4 | `metadata.government_designations` 어드민 별도 화면? | (a) `study_admission_specs.metadata` 안 (b) 별도 테이블 `study_government_designations` |
