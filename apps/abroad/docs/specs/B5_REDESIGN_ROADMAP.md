# 입학서류·표준데이터 재설계 — 로드맵 / 핸드오프

> compact·새 세션 후 **이 문서부터 읽으면** 재설계 맥락이 복구됩니다.
> 관련 마이그레이션: `B5_documents_standard_data.sql` (이미 라이브 DB에 적용됨).

## 1. 합의된 개념 모델

### 입학서류 = "문서". 3종, 성격이 달라 **테이블은 분리 + 통합은 뷰로**
| 종류 | 테이블 | 성격 |
|---|---|---|
| 모집요강 | `study_admission_specs` (기존) | 입학을 *정의*하는 원천. 학기별 갱신. 대학/학과 자동완성 소스. |
| 양식 | `study_admission_form_files` (기존) | 대학 제공 제출 *템플릿*. 파일+버전+에세이질문. |
| 직접제출 | `study_required_submissions` (B5 신설) | 학생이 발급/복사 제출. **샘플이미지** + **발급요건/리드타임**. |
| (통합) | `study_documents` 뷰 (B5) | 입학서류 메뉴 "모아보기" (UNION) |

- 모든 문서는 **대학(+학과)에 종속**. 관리는 **대학교 메뉴**에서, **입학서류 메뉴 = 모아보기(뷰)**.
- `universities`/`departments` = **리얼데이터, 절대 재생성 금지**(컬럼 추가만 신중히).

### 표준데이터 = 문서에 들어가는 정보. **2분류** + 부가기능
- scope **`university_info`**(대학/학과 정보 — 글로케어 편집·공개) / **`document_fill`**(서류작성 정보 — 학생·센터 편집)
- **별칭(`aliases`)**: AI가 "보호자 성명/Guardian name" 등 다른 이름을 기존 항목에 매칭 → 중복 추가 방지.
- **택1/파생(`is_derived`/`derived_role`/`derived_from`)**: 보호자 = 아버지/어머니 중 학생이 택1.
  - 기존 키: `father_name/occupation/contact/birth_date`, `mother_*` (전부 category=family).
  - 설계: `guardian_choice`(select: father|mother) + `guardian_*`(파생, derived_from={selector, map}).
  - **운영자가 어드민 UI에서 직접 설정**(SQL 시드 X) — 이게 핵심 결정.
- **서명(`input_type='signature'`)**: 서명패드(터치/마우스)→PNG→비공개 버킷. "서명 이미지" 수준(법적 e-sign 아님).

## 2. 완료된 것
- ✅ **B5 마이그레이션 라이브 적용** (직접제출 테이블, data-type 컬럼, signature, study_documents 뷰).
- ✅ **어드민 표준데이터 UI**: 별칭 태그 편집 + scope 선택 + signature 타입. 저장 동작.
  - 파일: `apps/admin/src/app/(app)/student-data-types/{type-form.tsx, actions.ts, [id]/edit/page.tsx}`
  - 타입: `apps/admin/src/types/database.ts` 의 `study_student_data_types` 에 새 컬럼 수동 추가됨.
- ✅ **택1/파생(보호자) 설정 UI** (커밋 `9588469`): 표준데이터 편집 폼에 `is_derived` 체크박스 +
  선택 기준(selector, select 타입 항목) 드롭다운 + 선택지별 원본 매핑 + 역할 라벨(`derived_role`).
  edit/new 페이지가 전체 타입 목록(`allTypes`)을 폼에 주입. 목록에 택1·파생/별칭 배지.
  - 저장 형식: `derived_from = {selector, map:{<선택지값>: <원본 key>}}`.
  - 예: `guardian_name` → selector=`guardian_choice`, map=`{father: father_name, mother: mother_name}`.
  - ⚠ 사전조건: 기준이 될 `guardian_choice`(select, options=father/mother) 항목을 **먼저 등록**해야
    매핑 UI에 선택지가 뜸. (운영자가 어드민에서 직접 생성 — SQL 시드 X.)
- ✅ **택1/파생 실제 작동 — 학생 상세정보 화면** (커밋 `e2042bd`): 파생 항목은 입력칸 대신
  **읽기전용**으로, `selector`+원본에서 **계산(resolve)** 한 값 표시. 값은 저장 안 함(항상 원본 기준).
  상태별 안내(미선택/원본빈값/매핑없음), 필수·완료 카운트도 계산값 반영.
  - abroad `types/study.ts`에도 B5 컬럼 + signature 추가됨.
  - ⏳ **남은 소비자**: 서류 채우기(docx/HWPX) 쪽도 같은 resolve 로직 필요 → 공용 헬퍼로 추출 권장.
- ✅ **직접제출 서류 관리 UI** (커밋 `c7dcd3c`): admin `/admissions/[universityId]` 에
  "직접제출 서류" 섹션. 샘플이미지 + 발급요건(발급처/리드타임/유효기간/공증·번역/메모) +
  별칭 + 표준데이터키 + 적용범위(대학전체/학과) + 상태(draft/approved/archived) CRUD.
  - 파일: `components/admission/required-submissions-manager.tsx`,
    `app/(app)/admissions/[universityId]/submissions-actions.ts`, 같은 폴더 `page.tsx` 4번 섹션.
  - types/database.ts 에 `study_required_submissions` 테이블 타입 추가.
  - ⚠ 샘플이미지 = **공개** `admission-form-files` 버킷의 `required-submissions/` 경로 사용
    (로드맵 원안 "비공개"와 다름 — 빈 예시 문서라 양식 템플릿과 동급. 필요시 비공개+서명URL 전환).

- ✅ **서명 패드** (커밋 `f41ef5f`): 캔버스(마우스/터치/펜) 서명 → PNG → 비공개 버킷
  `student-files` 업로드. 상세정보 화면 `signature` 입력타입에 연결. 값은 파일과 동일한
  `{path, file_name}` 형태로 저장 → 기존 보기(서명URL)/다시서명/삭제 흐름 재사용.
  - 파일: `components/signature-pad.tsx`(범용, ref로 toDataURL/clear/isEmpty),
    `student-data-editor.tsx` 의 `SignatureInput` + ValueInput `case "signature"`.

- ✅ **별칭·파생을 양식 AI 추출에 연결** (커밋 `0aae4e4`): 양식 분석(analyze-form)이
  카탈로그를 받을 때 별칭·파생 표기까지 포함. 프롬프트에 별칭 매칭 규칙 + missing 중복 방어 필터.
  - 파일: abroad `lib/admission/analyze-form.ts`, admin `lib/admission/call-analyze-form.ts`,
    `forms/actions.ts`, `forms/[formId]/essay-questions/actions.ts`.
  - ⚠ **모집요강 추출(`/api/admission/extract`)은 available_data_types 미사용** — 별칭 매칭 대상 아님.
    양식(form_files) 분석 경로에만 적용됨. 모집요강에도 필요하면 별도 작업.

- ✅ **통합 목록 UI** (커밋 `4b05168`): 입학서류 홈(`/admissions`)을 `study_documents` 뷰 기반
  모아보기로 개편. 대학별 요약(모집요강/양식/직접제출 카운트) + 전체 문서 통합 목록
  (종류 필터칩 + 검색, 관리 허브 링크). admin database.ts Views에 study_documents 등록.
  - 파일: `admissions/page.tsx`, `admissions/documents-explorer.tsx`.
  - IA 확립: **입학서류=뷰(모아보기)**, 편집은 **대학별 관리 허브**(`/admissions/[id]`).

- ✅ **삭제 안전장치** (커밋 `f5a3c6f`): 표준데이터 삭제 시 연결 데이터(학생값/양식/직접제출/
  파생참조) 집계 → 연결 있으면 경고 모달(비활성화 권장 / 그래도 삭제 / 취소). 기본은 차단,
  force 일 때만 강제 삭제. `deactivateDataTypeAction`(is_active=false 소프트삭제) 추가.
  - 파일: `student-data-types/actions.ts`, `type-form.tsx`. admin db.ts에 study_student_data_values 추가.

## 2-1. 테스트 피드백 반영 (이후 추가)
- ✅ 모집요강 스키마/추출: 과정(degree)·년제(학과레벨)·어학연수 구분, 서류 대상자(self/father/mother/other),
  토픽 대체경로 '기타', 예금주 self/parent/other+note, 무제한 정원, 전형카테고리 화면 제거 예정.
- ✅ 중복 승인: 자동 덮어쓰기 → **대학+학기 갱신 확인 배너**(approve-action confirm_replace).
- ✅ 표준데이터 **활성화 버튼**(비활성 항목 재활성화).
- ✅ 센터 네비 전체폭(로고 좌측, VI 2줄 방지). 모아보기 양식명=파일명. 대학별 요약 동명 대학 합치기.
- ✅ **학생 1방향 플로우**(기본등록→대학선택→상세정보→서류작성→검토·컨펌→다운로드),
  자기소개서·입학원서를 '서류 작성' 한 단계로 통합.
- ✅ **공용 직접제출 서류 + 대학별 오버라이드**(SQL: university_id nullable, base_submission_id,
  target_person). 입학서류 홈 '공용 제출서류' 섹션 + 대학 허브 오버라이드(HubGlobalOverrides).
  - ⏳ 남은 모집요강 편집 UI: 학과 degree/년제 드롭다운, 서류 대상자, 토픽/예금주 '기타', 전형카테고리 칸 제거.

## 3. 다음 할 일 (후속 PRD 단계 — 각각 큰 작업)
1. **입력링크** — 학생/센터가 상세정보·서명을 채우는 외부 공유 링크.
2. **docx/HWPX AI 채움** — 표준데이터로 양식 자동 채우기 (파생 resolve 공용 헬퍼 필요).
3. **일정/리드타임 관리** — 직접제출 발급요건(lead_time_days) 기반 준비 일정.
4. **표준입학허가서 · 수수료 정산** — 유저플로우 PRD 후반.

> ✅ B5 핵심 전부 완료: 택1/파생(설정+자동해석) · 직접제출 · 서명패드 · AI 별칭연결 · 통합뷰 · 삭제안전장치.

## 4. 환경/워크플로 메모
- 모노레포 `C:\dev\glocare` (npm workspaces). dev 포트 고정: **abroad 3000 / admin 3001 / caregiver 3002**.
- 단일 라이브 Supabase(`oczjvsxmlbuicyhheelc`). **DB변경 = Claude가 SQL 작성 → 운영자가 Supabase에서 실행.**
- admin→abroad AI 추출: `EXTRACTION_API_URL`=abroad(3000). 토큰=`INTERNAL_API_TOKEN`(일치).
- 커밋은 로컬 자동, **push/배포는 명시 요청 시만**.
- abroad 비공개 버킷 `student-files` (서명·파일 업로드용).
