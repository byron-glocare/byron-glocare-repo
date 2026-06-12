# C. 핵심 워크플로 재정의 — 핸드오프 (2026-06)

> 새 세션은 **이 문서부터** 읽고 시작. 직전 단계: B5(직접제출·온라인접수·서명·파생 등) 완료.
> 관련: `B5_REDESIGN_ROADMAP.md`(이전 단계), `spec-schema.ts`(추출 스키마), `C1_offerings.sql`(모집 테이블).

## 0-B. 학생 상세 페이지 탭 재설계 (2026-06-12)
> 센터(3000) 학생 상세를 **고정 탭 위저드**로 전면 재구성. 커밋 다수.
> ⚠ **운영자 실행 필요 SQL**: `C4_application_status.sql`(단계값), `C5_student_submission_files.sql`(제출서류 파일) — **둘 다 실행 완료**.
- **탭 구조**(layout.tsx + student-tabs.tsx, sticky): 개요 → 대학 선택 → 서류 등록 → 정보 입력 → 최종 서류.
  글로벌 기본정보수정 제거(개요 '편집'), 학생삭제 작게.
- **개요**(page.tsx) = 모아보기 4섹션(없으면 '없음'): 기본정보(+편집) / 대학정보(대학·학과·학기 +
  **다가오는 일정**=모집요강 schedule, 단계 즉시변경 StatusSelect, 지원포기, 모집요강 버튼) /
  상세정보(완성도 막대) / 서류(준비됨·미완료). 작성서류 완비 시 **1회 팝업**(DocsCompletePopup)+배너.
- **단계 재정의**(C4): payment_pending/preparing/docs_complete/submitted/enrolled/rejected/cancelled.
  study.ts ApplicationStatus, applications/status.ts(라벨/톤).
- **서류 등록**(documents): '제출서류 = 업로드'로 통합. 제출서류 목록 각 항목에 업로드 슬롯
  (study_student_submission_files, C5). 발급조건 노출. 첨부파일(파일타입 표준데이터) 섹션 폐지.
  공통 로더 lib/center/student-data-context.ts. (AI 자동추출은 보류.)
- **정보 입력**(data): 이름변경 + 파일타입 제외(서류 등록으로 이동).
- **최종 서류**(final): 지원별 작성서류 **DOCX 생성**(buildSheetDocx, docx 패키지) +
  제출서류 **리네임 다운로드**. 파일명 `양식명/서류명_이름(영대)_대학_학과_학기.확장자`.
  라우트 final/docx, final/submission. (HWPX 기존 /forms 는 잔존.)
- ⏳ 남은 것: **서류 업로드 AI 추출**(보류). 옛 /forms 정리.

## 0. 진행 상황 (2026-06-10)
- ✅ **우선순위 §5-1 모집(offering) 엔티티 완료** (커밋 `ad0d8ae`, `fe29c9a`):
  - `study_offerings` 테이블 라이브 적용(`C1_offerings.sql`): 대학×학과×학기 + intake_quota(모집수,
    published 시 필수 CHECK) + language_track + student_location_scope + status + source_spec_id(nullable FK).
    `study_applications.offering_id` nullable 추가.
  - 어드민 **/offerings** 큐레이션 UI(대학별 그룹, 모집수·트랙·위치·상태·모집요강연결, 노출/숨김 토글). nav "모집".
  - 센터 **/center/admissions** 상단 "모집 중"(published offering) 섹션.
  - 학생 희망선택(**applications/new**) offering-우선(모집요강 직접선택 폴백). offering 선택 시
    admission_spec_id=source_spec_id, offering_id, **target_department_id 실제 FK** 채움.
- ✅ **우선순위 §5-2 리드타임 역산 얼럿 완료** (웹):
  - 공용 헬퍼 `lib/center/lead-time.ts` `computeLeadTimeFlags()` — 직접제출 `lead_time_days` +
    지원 `next_deadline` 역산 → 지금 발급 착수해야(또는 마감 지남) 하는 지원/서류 산출.
    (RLS org 범위. 제출전 단계만. next_deadline 미설정 지원 제외 — v1 한계.)
  - 센터 대시보드 카드 "서류 준비 착수 필요"(카운트) + **/center/alerts** 상세 리스트
    (학생·대학·마감 D-day·착수 권장일·서류별 리드타임). 문자·이메일·푸시 X(웹 전용, 운영자 결정).
  - ⏳ 한계: 학생이 특정 서류 발급 완료했는지 추적 테이블 없음 → "착수 시점 도래" 기준 독촉용.
    마감 출처도 next_deadline 만(spec.schedule 파싱 미연동).
- ✅ **우선순위 §5-3 언어/거주지 옵션 + 서류 분기 완료** (`C2_offering_options.sql` — ⚠ 운영자 실행 필요):
  - 모델 변경(운영자 결정): 언어/거주지는 offering 고정 축이 아니라 **글로케어가 옵션세트를 정하고
    학생이 1개 선택**. offering `language_track`/`student_location_scope` 제거 →
    **`available_languages[]`**(korean/english/other) / **`location_options[]`**(domestic/overseas, 빈=분기없음).
    offering unique = (univ,dept,term)로 단순화.
  - 학생 선택값: `study_applications.selected_language` / `selected_location`.
  - 서류 분기: `study_required_submissions.applies_to_languages[]` / `applies_to_locations[]`
    (빈=전체, 값 있으면 그 선택 학생만).
  - 어드민: offerings 폼 = 언어 체크박스(한국어/영어/기타) + 거주지 분기(국내/해외). 직접제출 매니저 =
    적용 조건(언어/거주지) 태그.
  - abroad: 학생 희망선택 시 언어(필수)·거주지(옵션 있으면 필수) 선택 → 저장. 센터 "모집 중" 표시 갱신.
    **리드타임 얼럿 + 접수준비 제출서류 목록이 선택값으로 분기**(applies_to 필터).
- ✅ **우선순위 §5-4 새 제출서류 키 완료**: `studentDocumentTypeEnum`(spec-schema.ts) +
  추출 프롬프트(extract.ts) + 어드민 라벨(required-documents-field.tsx)에
  `parents_employment_proof`(부모 재직), `parents_income_proof`(부모 소득),
  `tb_certificate`(결핵 진단서), `health_certificate`(건강진단서) 추가. AI 추출이 인식.
- ✅ **테스트 피드백 반영 (2026-06-11)**:
  - 센터 `/center/admissions` = **published offering만** 노출(approved spec 직접 노출 표 제거).
    카드 클릭 → 그 모집요강 상세(source_spec_id).
  - **offering에서 언어·거주지 입력 제거** (운영자 결정): 둘 다 모집요강/학생속성에 이미 있음.
    · 언어 = 연결 모집요강 eligibility에서 도출(`lib/admission/offering-languages.ts`
      `deriveOfferingLanguages`: 한국어 항상 / 영어 if english_proficiency·해당학과). 학생이 선택.
    · 거주지 = 학생 `study_managed_students.location`(KR=국내/그외=해외) 그대로. 지원 시 안 물음.
      (`residenceFromStudentLocation`). 서류분기(얼럿·접수준비)도 이걸로.
    · offering = 대학·학과·학기 + 모집수 + 모집요강연결 + 노출. (순수 큐레이션)
    · ⚠ DB컬럼 offering.available_languages/location_options, applications.selected_location 은
      미사용 상태로 남겨둠(드롭 SQL 미실행). 추후 정리.
    · ⏳ 서류별 국내/해외 분기 태그는 현재 직접제출 `applies_to_locations`(수동). 추후 모집요강 AI 추출로 자동화 옵션 있음.
- ⏭ **다음**: §5(1~4) 완료. 이후는 §6-B 백로그(모집요강 편집 UI 잔여, QA 수정, docx/HWPX 자동채움, 입력링크 등).

## 1. 확정된 핵심 비전 (6단계)
플랫폼의 진짜 가치는 "모집요강 입력"이 아니라 **글로케어가 무엇을 얼마나 모집할지 관리 + 학생 서류 준비 자동화**.

1. **큐레이션** — 글로케어가 어느 **대학/학과(어학당 포함)/학기**를 유학센터에 줄지 결정.
2. **상세 등록** — 결정된 대학/학과/학기를 **표준화 데이터로 등록**. 모집요강 업로드 = 빠른 입력 *도구*(핵심 아님). AI 추출값은 글로케어가 **컨펌**. ★ 이 단계에서 **학기별 모집수**(글로케어 운영 모집인원)를 넣음.
3. **조회** — 유학센터 관리자가 대학/학과/학기 정보 조회.
4. **학생 입력** — 학생 정보 입력. **가장 중요 = 희망 대학/학과/학기**.
5. **접수 준비** — 작성서류 자동 생성 + 제출서류 목록 + **서류별 세부조건(발급일/발급기관/발급대상자 등)**. 온라인 접수 대학은 가이드 파일 참고해 작성.
6. **리드타임 얼럿** ★중요 — 제출서류(학생이 발급받아 내는 것)는 **발급 소요기간(일)**이 있음. 글로케어가 입력 → 제출일정에서 **역산**해 "지금 시작해야 한다"고 유학센터에 **얼럿**.

## 2. 이번 세션 결정사항
- **편입 제외**: 신입학만 고려. 대신 **학생 현재 위치/체류상태로 서류 분기**:
  - 베트남 체류 vs 한국 체류(대부분 어학당 **D-4**) → 필요 서류가 달라질 수 있음. (위치 차원 추가, 편입 차원 대체)
- **언어 트랙**(한국어/영어/중국어): 학과 레벨 반영 (영어트랙=TOPIK 대신 영어성적).
- **모집 정원**: 모집요강의 capacity(무제한/30명)보다 **글로케어의 학기별 모집수(5·10명 등)가 핵심**.
  **등록/노출 중인 모든 학과는 "앞으로 모집할 학기"의 학기별 모집수가 필수값.**
- **새 제출서류 종류**: 부모 재직·소득증명, **결핵 진단서**(베트남=고위험국, 사실상 필수).

## 3. 현재 구조 vs 비전 (gap)
| 단계 | 현재 | 필요 작업 |
|---|---|---|
| 1 큐레이션 | 없음(universities/departments active 플래그만) | **모집(offering) 엔티티 신설** |
| 2 상세등록 | 모집요강 추출/검수/승인 O. 단위=spec(대학-학기) | **학과×학기 offering + 학기별 모집수(필수)** 추가, 모집요강은 정보 원천으로 유지 |
| 3 조회 | 유학센터 admissions 페이지 O | offering 기반으로 보강 |
| 4 학생입력 | 지원=학생↔spec O | **희망 = offering(대학/학과/학기) 선택**으로 명확화 |
| 5 접수준비 | 양식작성·직접제출·온라인가이드 = **구현됨 ✅** | offering 연결 다듬기 |
| 6 리드타임얼럿 | `issuance.lead_time_days` 만 있음 | **역산·얼럿 미구현(신규, 중요)** |

## 4. 제안 구조 (핵심 변경)
- **신규 테이블 `study_offerings`** (가칭): `(university_id, department_id, term, intake_quota[모집수], status, language_track, student_location_scope?)`.
  글로케어 큐레이션 단위. 노출 offering은 **intake_quota 필수**.
- **모집요강(spec)** = 표준 입학정보(eligibility/required_documents/schedule)의 **원천**. offering이 참조(같은 대학/학기 공유).
- **학생 지원(application)** = offering 선택(희망 대학/학과/학기).
- **6단계 얼럿**: 직접제출 `lead_time_days` + 제출/모집 마감 → 역산 → 센터 대시보드 얼럿.
- 학과: `language_track`(korean/english/chinese), 서류분기용 `student_location` 차원.
- 제출서류 키 enum 확장: parents_income_proof, health/tb_certificate.

> ⚠️ offering 도입 시 기존 지원/양식/직접제출 연결을 spec→offering로 잇는 마이그레이션 설계 필요(라이브 데이터 보호).

## 5. 우선순위 (다음 세션)
1. ~~**모집(offering) + 학기별 모집수**~~ ✅ 완료 (§0 참조).
2. ~~**6단계 리드타임 역산 얼럿**~~ ✅ 완료 (웹 대시보드 카운트 + /center/alerts, §0 참조).
3. ~~언어 + 거주지 서류 분기~~ ✅ 완료 (옵션세트+학생선택+applies_to 필터, §0 참조).
4. ~~새 제출서류 키~~ ✅ 완료 (parents_employment/income_proof, tb_certificate, health_certificate).

> §5(1~4) 전부 완료. 다음은 §6-B 백로그.

## 6-B. 보류·미해결 백로그 (과거 세션에서 답 못 받고 넘어간 것들)
> 우선순위는 위 §5(현재 비전)이 먼저. 아래는 그 다음 또는 틈틈이.

### (a) 모집요강 새 필드 **편집 UI** — 스키마·추출프롬프트는 됐으나 어드민 UI 미반영
- 학과 **degree(전문/학사/석사/박사)·년제** 드롭다운 편집, **어학연수(program_kind)** 토글
- **무제한 정원** 선택 UI
- 서류 **대상자(본인/부/모/기타)** 편집
- 한국어 **대체경로 '기타'**, **예금주 '기타'+텍스트** 편집
- **전형카테고리(admission_category) 화면 제거** (제거 결정났으나 review/edit 폼에 아직 남아있음)
- (참고) 추출 raw·DB엔 새 값이 들어가지만, 검수 폼에서 예쁘게 못 고침

### (b) QA 미수정 (동작은 하나 다듬을 것 — 이전 QA 리포트)
- M1 boolean "아니오"(false) 저장/표시 불일치
- M2 추출 응답 `res.ok` 미확인(에러 메시지 뭉뚱)
- M3 대학/학과 생성 ↔ spec insert 비원자성(실패 시 고아 학과)
- M4 표준데이터 삭제 사용처 집계가 이력/비활성까지 카운트(정책 결정)
- L1 공개버킷 path 추출 정규식 쿼리스트링 취약
- L2 직접제출 카운트가 draft/archived 포함해 부풀려짐
- L3 서명패드 빈 판정(스테일 클로저 → 픽셀 기반 권장)
- L4 첨부/샘플 삭제 best-effort → 고아 파일 누적
- L5 양식 archive 복원 동시성 가드 없음

### (c) 데이터·도구
- **모집요강 JSON 일괄 import 스크립트**(추출본 → draft 일괄 insert, 대학 매칭/학과 자동생성) — 제안만 함, 미구현
- 11개 인벤토리 분석의 선택 3개: **지원경로(채널)**(학생/지원 필드), **메신저(카톡) 연락처**, **면접고사료**

### (d) B5 후속 PRD (큰 작업)
- **docx/HWPX AI 자동채움**(공식 양식 자동 작성) — 시스템 최대 차별화, 미구현
- **입력링크**(학생/센터 외부 공유로 상세정보·서명 채우기)
- **표준입학허가서**, **수수료 정산**
- (일정/리드타임 관리는 §1 6단계로 승격됨)

## 6. 세션 관리
- 컨텍스트 가득 → **/compact 보다 새 세션 권장**(새 국면). 이 문서가 핸드오프.
- 새 세션 첫 메시지: "C_CORE_WORKFLOW_REDESIGN.md 읽고 시작하자".
