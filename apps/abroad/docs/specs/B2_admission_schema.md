# B2 모집요강 스키마 (PoC Step 3 lock)

작성: 2026-05-26 · 출처: [PoC step1 7건](../../reports/admission_poc/step1_raw/) + [step2 inventory](../../reports/admission_poc/step2_field_inventory.md) · 사용자 결정 2026-05-26 (S3-1, S3-2)

## 결정 요약

| 항목 | 결정 |
|---|---|
| **`study_admission_specs` 컬럼 구조** | 5 JSONB (PLAN_B §8.2 유지) + 신규 `metadata` JSONB + 신규 `departments` JSONB |
| **multi-department 표현** | row 1건 + `departments[]` JSONB. UNIQUE = (university_id, term, admission_category) |
| **글로케어 운영자 라벨링 (`is_glocare_target`)** | departments 항목당 boolean. B1 스키마에 포함하되 어드민 UI 는 B+ 검토 |
| **`government_designations[]`** | `metadata.government_designations[]` 안에 배열로. 별도 테이블은 B+ |
| **베트남 순수외국인 필터** | 추출 단계에서 항상 적용. spec_data 안에 다른 국적 정보 X. 메모리: [feedback-target-vietnam-pure-foreigner](../../../../.claude/projects/C--Users-kajka-OneDrive-Desktop-glocare-homepage-abroad/memory/feedback_target_vietnam_pure_foreigner.md) |

## 코드 산출물

- **zod 스키마**: [src/lib/admission/spec-schema.ts](../../src/lib/admission/spec-schema.ts) — 약 230줄, 9개 sub-schema + 6개 enum

## 스키마 5+1+1 구조 (한 눈 정리)

```
study_admission_specs (row)
├─ id, university_id, term, admission_category, program_type, status, source_file_url, ai_extraction_log, approved_by, approved_at, created_at, updated_at
├─ departments         JSONB[]    ← 신규 (multi-department)
├─ required_documents  JSONB[]    ← PLAN_B §8.2 유지
├─ eligibility         JSONB{}    ← PLAN_B §8.2 유지
├─ schedule            JSONB{}    ← PLAN_B §8.2 유지
├─ tuition             JSONB{}    ← PLAN_B §8.2 유지
├─ scholarships        JSONB[]    ← PLAN_B §8.2 유지
└─ metadata            JSONB{}    ← 신규 (selection_process, post_acceptance, living_cost, forms, contacts, government_designations, country_specific_notes_vi, language_program, extra)
```

## B1_schema.sql 갱신 권고 사항

현 [B1_schema.sql §5 `study_admission_specs`](./B1_schema.sql) 의 변경 필요 부분:

### 변경 1 — 컬럼 추가·제거

```sql
ALTER TABLE study_admission_specs
  DROP COLUMN department_id,                            -- multi-department 도입으로 제거
  ADD COLUMN program_type text NOT NULL DEFAULT 'bachelor_4yr'
    CHECK (program_type IN ('language_program','associate_2yr','bachelor_3yr_extension','bachelor_4yr')),
  ADD COLUMN admission_category text,                   -- '순수외국인 특별전형' / '글로벌요양복지과' 등 (학교별 표현)
  ADD COLUMN departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
```

### 변경 2 — UNIQUE 제약 변경

```sql
ALTER TABLE study_admission_specs
  DROP CONSTRAINT IF EXISTS study_admission_specs_university_id_department_id_term_key,
  ADD CONSTRAINT study_admission_specs_unique_spec
    UNIQUE NULLS NOT DISTINCT (university_id, term, admission_category);
  -- NULLS NOT DISTINCT 는 Postgres 15+. admission_category=null 행도 1건만 허용
```

### 변경 3 — `study_applications` 의 학과 식별 보강

학과가 row 컬럼에서 빠졌으므로, 학생 지원 시 어느 학과인지 별도 명시 필요:

```sql
ALTER TABLE study_applications
  ADD COLUMN target_department_id uuid REFERENCES departments(id),
  ADD COLUMN target_department_label text;               -- spec.departments[] 의 name (FK 없는 경우 자유 텍스트)
```

→ `target_department_id` 가 우선, 없으면 `target_department_label` (자유 텍스트). 이건 운영자가 학생 지원 등록 시 spec 의 departments[] 중 하나를 선택하는 UX.

### 변경 4 — 인덱스 보강

```sql
CREATE INDEX idx_study_admission_specs_program
  ON study_admission_specs (program_type, status)
  WHERE status = 'approved';

CREATE INDEX idx_study_admission_specs_term
  ON study_admission_specs (term, status)
  WHERE status = 'approved';

-- 학과명 검색용 GIN (departments[] 안의 name 으로 검색)
CREATE INDEX idx_study_admission_specs_departments_gin
  ON study_admission_specs USING GIN (departments jsonb_path_ops);

-- 정부 지정 학교 빠른 필터
CREATE INDEX idx_study_admission_specs_gov_designations
  ON study_admission_specs USING GIN ((metadata -> 'government_designations'));
```

### 변경 5 — RLS 영향 없음

기존 `specs_admin_all` / `specs_read_approved` 정책은 그대로 유효. multi-department 도 RLS 와 무관.

## 다음 액션

- [ ] 사용자 검토 → 위 ALTER SQL 을 B1_schema.sql 본문에 반영하거나 별도 마이그레이션 파일로 분리
- [ ] (선택) step4 — 사용자가 제공한 모집요강 1-2건을 위 zod 스키마 기준으로 다시 추출하여 신뢰도 비교 (`reports/admission_poc/step4_confidence_eval.md`)
- [ ] B2 본격 진입: 어드민에서 PDF 업로드 → Sonnet vision 호출 → spec-schema.ts 검증 → 검수 화면 → approved → DB insert. 이건 Phase B2 의 첫 산출물

## PoC 가 schema 에 남긴 흔적 (참고)

| step1 발견 | spec-schema.ts 반영 위치 |
|---|---|
| program_type 분류 | `programTypeEnum` (top-level + row 컬럼) |
| multi-department | `departments: DepartmentItem[]` |
| schedule.rounds[] | `admissionRoundSchema` 배열 |
| 한국어 OR 5+ 경로 | `koreanAlternativePathSchema` discriminated union (6 types) |
| 학과 카테고리별 한국어 분기 | `topik_min_by_dept_category: Record<string, number>` |
| 영어 대체 (일부 학과만) | `english_proficiency.applies_to_departments[]` |
| 등록금 학부별 차등 | `tuition_by_faculty: Record<string, number>` |
| 등록금 미공개 | `tuition.disclosure_state: 'pending_until_acceptance'` |
| TOPIK stepped 장학금 | `scholarship.tiered_by_topik: Record<topik_grade, value>` |
| 장학금 중복불가 | `scholarship.exclusivity_with[]` |
| 정부 지정 (명지) | `metadata.government_designations[]` |
| 베트남 특화 룰 | `notarization: 'consul_for_vietnam'` + `metadata.country_specific_notes_vi` |
| 학교 소정 양식 | `metadata.forms.*` boolean flags |
| 어학연수 상세 | `metadata.language_program.*` |
| 생활비 (DI 만 상세) | `metadata.living_cost.*` (optional) |
| 전형 점수 가중 | `metadata.selection_process.score_breakdown` |
| 비자 절차 (베트남 추가서류) | `metadata.post_acceptance.vn_specific_visa_documents[]` |
| 글로케어 ICP 라벨 | `department.is_glocare_target: boolean` (B+ UI) |
