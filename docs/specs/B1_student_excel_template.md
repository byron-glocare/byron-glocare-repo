# B1-3 / 학생 일괄 업로드 엑셀 양식 (초안)

작성: 2026-05-26 · 출처: PLAN_B.md §6 (L184), Decision Log #11 · 관련: [B1_schema.sql](./B1_schema.sql)

> 유학센터 담당자가 신규 학생들을 한 번에 등록할 수 있도록 표준 엑셀(.xlsx) 양식 제공. 헤더는 베트남어(주), 한국어(부) 병기. 업로드 시 행 단위 검증 후 부분 성공 허용.

---

## 1. 양식 파일 구조

파일명: `glocare_student_template_<버전>.xlsx`

| 시트 | 용도 |
|---|---|
| `Sinh viên` | 학생 데이터 입력 (메인) |
| `Hướng dẫn` | 컬럼 설명·예제·코드값 |
| `Mã tham chiếu` | 대학·학과 코드 참조표 (글로케어가 미리 채워 배포) |

---

## 2. `Sinh viên` 시트 컬럼

| # | 컬럼 (VI / KO) | DB 매핑 | 필수 | 형식 / 검증 |
|---|---|---|---|---|
| A | `Họ và tên` / 이름 | `study_managed_students.name` | ✔ | text, 100자 이내 |
| B | `Ngày sinh` / 생년월일 | `.dob` | ✔ | `YYYY-MM-DD` 또는 엑셀 날짜 |
| C | `Số hộ chiếu` / 여권번호 | `.passport_no_encrypted` (서버에서 암호화) | ✖ | text, 4~20자 영숫자. 없으면 비움 |
| D | `Số điện thoại` / 전화번호 | `.phone` | ✖ | E.164 권장 (`+8490...`). 베트남 0xx도 허용, 서버가 정규화 |
| E | `Email (sinh viên)` / 이메일(학생) | `.email` | ✖ | 형식 검증. **알림 발송 X** (Decision #7) — 메타데이터로만 |
| F | `TOPIK` / TOPIK 급수 | `.topik_level` | ✖ | `1`~`6` 중 하나, 없으면 비움 |
| G | `Visa hiện tại` / 현재 비자 | `.current_visa` | ✖ | `D-4` / `D-2` / `none` / `other` (드롭다운) |
| H | `Vị trí` / 현재 위치 | `.location` | ✖ | `VN` / `KR` / `other` (드롭다운) |
| I | `Mã trường ĐH dự kiến` / 지원 희망 대학 코드 | (간접) → `study_applications.admission_spec_id` | ✖ | `Mã tham chiếu` 시트 참조. 비우면 학생만 등록 |
| J | `Mã ngành dự kiến` / 지원 희망 학과 코드 | (간접) | ✖ | `Mã tham chiếu` 참조. I가 채워졌으면 필수 |
| K | `Học kỳ` / 학기 | (간접) | ✖ | `2026-Spring` / `2026-Fall` 등. I·J 있으면 필수 |
| L | `Ghi chú` / 메모 | `.notes` | ✖ | 자유 텍스트, 500자 이내 |

### 매칭 로직 (서버 측)
- I·J·K 모두 채워진 행: 등록 후 `study_admission_specs (university_id, department_id, term)` 매칭 → `study_applications` row 자동 생성 (`status='preparing'`)
- I·J·K 중 하나라도 비면: 학생만 등록, 지원은 화면에서 별도 추가
- I·J·K 채워졌으나 해당 모집요강이 `approved` 가 아니거나 없음: 학생은 등록되되 지원은 만들지 않고 경고

### 중복 처리
- 같은 org 내 `(name, dob)` 일치 행: **기본 skip**, 사용자가 옵션으로 "덮어쓰기" 체크 시 update
- 여권번호(C) 일치는 보조 매칭 키 (대소문자 무시)

---

## 3. 검증 룰 (zod 스키마 초안)

```ts
// src/lib/center/student-import.ts
import { z } from "zod";

const TOPIK_VALUES = ["1","2","3","4","5","6"] as const;
const VISA_VALUES = ["D-4","D-2","none","other"] as const;
const LOC_VALUES = ["VN","KR","other"] as const;

export const studentRowSchema = z.object({
  name: z.string().min(1).max(100),
  dob: z.union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  passport: z.string().regex(/^[A-Za-z0-9]{4,20}$/).optional().nullable(),
  phone: z.string().min(8).max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  topik: z.enum(TOPIK_VALUES).optional().nullable(),
  visa: z.enum(VISA_VALUES).optional().nullable(),
  location: z.enum(LOC_VALUES).optional().nullable(),
  univCode: z.string().optional().nullable(),
  deptCode: z.string().optional().nullable(),
  term: z.string().regex(/^\d{4}-(Spring|Fall)$/).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).refine(
  (r) => !r.univCode || (r.deptCode && r.term),
  { message: "지원 의향이 있으면 학과·학기가 모두 필요합니다" }
);
```

서버는 행 단위로 검증, 실패한 행만 결과 화면에서 빨간색 + 오류 사유 표시. **부분 성공** (성공 행은 commit, 실패 행은 사용자가 수정 후 재업로드).

---

## 4. `Hướng dẫn` 시트 내용

- 각 컬럼별 한 줄 설명 (베트남어, 한국어)
- 드롭다운 값 목록 (TOPIK / Visa / 위치)
- 예제 row 3개 (지원 의향 있는 케이스 / 없는 케이스 / 메모만 채운 케이스)
- 에러가 났을 때 "Mã tham chiếu" 시트에서 대학·학과 코드를 확인하라는 안내
- 1회 업로드 권장 행 수: **최대 500행** (그 이상은 분할)

---

## 5. `Mã tham chiếu` 시트

서버가 빌드 시점에 `universities` × `departments` 를 dump 한 결과를 시트에 채워 배포. 사용자가 직접 수정하지 않음.

| 컬럼 | 내용 |
|---|---|
| `Mã ĐH` | universities.id 의 외부 표현 — 짧은 코드(예: `KU`, `SNU`) 또는 그냥 university name 사용. **B1-3 결정 필요**: 단순화 위해 정확한 한국어 대학명 매칭으로 갈지, 별도 코드 컬럼을 도입할지 |
| `Tên trường (KO)` | universities.name_ko |
| `Tên trường (VI)` | universities.name_vi (있다면) |
| `Mã ngành` | departments 단위 코드 |
| `Tên ngành (KO)` | departments.name_ko |
| `Tên ngành (VI)` | (있다면) |
| `Học kỳ có sẵn` | 해당 학과의 `study_admission_specs.term` 중 `approved` 인 것들 (콤마구분) |

> 메모: 기존 `universities` / `departments` 의 정확한 컬럼은 `src/types/database.ts` 확인 후 코드 컬럼 추가 여부 결정. **외부 코드(예: `KU-BUS-2026S`) 를 추가하는 게 깔끔할 듯** — B1-3 구현 단계에서 확정.

---

## 6. 업로드 UX 흐름

`/center/students/import` 페이지:

```
1. [템플릿 다운로드] 버튼  ← 현재 active 모집요강 기준으로 매번 새로 생성
2. [파일 선택] 드래그앤드롭 또는 파일 선택
3. [미리보기]  ← 첫 5행 + 검증 결과 표시
4. [확정 업로드]  ← 성공/실패 카운트
5. [결과 다운로드]  ← 실패 행만 오류 사유 컬럼 추가된 엑셀
```

서버 측:
- `src/app/center/actions/students-import.ts` Server Action
- xlsx 파싱: **순수 JS 라이브러리 미설치**. B1-3 구현 시 추가:
  - 후보 1: `xlsx` (SheetJS, MIT 무료판)
  - 후보 2: `exceljs` (스타일·검증 자동 생성 기능)
  - **`exceljs` 추천** — 다운로드용 템플릿을 동적 생성할 때 드롭다운·셀 스타일 지원

---

## 7. B1 산출물 (구현 체크리스트)

- [ ] `npm i exceljs zod` (zod 는 이미 있음)
- [ ] `src/lib/center/student-import.ts` — `studentRowSchema` + 행→DB 변환
- [ ] `src/lib/center/student-template.ts` — 동적 .xlsx 생성 (current `approved` admission_specs 반영)
- [ ] `src/app/center/(authed)/students/import/page.tsx` — UI
- [ ] `src/app/center/actions/students-import.ts` — Server Action (검증·삽입·결과 반환)
- [ ] i18n 키 추가: `center.import.*` (베/한)
- [ ] 통합 테스트 시나리오: 정상 5행 / 필수누락 1행 / 코드 불일치 1행 / 중복 1행 → 결과 확인

---

## 8. 결정 필요 항목 (B1-3 구현 진입 시)

| # | 항목 | 옵션 |
|---|---|---|
| T-1 | 대학·학과 외부 코드 도입 | (a) 한국어 이름 매칭만 / (b) 코드 컬럼 신규 추가 → 추천: **(b)** 안정적 매칭 |
| T-2 | 학생 중복 판정 키 | (a) (name, dob) / (b) passport / (c) 둘 다 — 추천: **(c)** 둘 다 매칭 |
| T-3 | 1회 업로드 행 수 제한 | 500 / 1000 / 무제한 — 추천: **500** (큰 파일은 분할 안내) |
| T-4 | 실패 행 결과 다운로드 형식 | 원본+오류 컬럼 추가 / 실패 행만 / 둘 다 — 추천: **원본+오류 컬럼** |

이 4개는 B1 구현 시작 시 사용자 확인 후 결정.
