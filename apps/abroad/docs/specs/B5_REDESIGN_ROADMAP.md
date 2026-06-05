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

## 3. 다음 할 일 (우선순위)
1. **직접제출 서류 화면** — `study_required_submissions` CRUD + 샘플이미지 업로드(비공개 버킷).
2. **서명 패드 컴포넌트** — signature 입력타입 렌더(캡처→버킷), 센터 상세정보/입력링크에서 사용.
3. **별칭·파생을 AI 추출에 연결** — 모집요강/양식 추출 시 기존 항목 매칭, 중복 제안 방지.
4. **통합 목록 UI** — `study_documents` 뷰 기반 입학서류 모아보기 + IA(대학교=관리/입학서류=뷰).
5. (유저플로우 PRD의 후속) 입력링크·docx AI채움·일정/리드타임 관리·표준입학허가서·수수료 정산.

## 4. 환경/워크플로 메모
- 모노레포 `C:\dev\glocare` (npm workspaces). dev 포트 고정: **abroad 3000 / admin 3001 / caregiver 3002**.
- 단일 라이브 Supabase(`oczjvsxmlbuicyhheelc`). **DB변경 = Claude가 SQL 작성 → 운영자가 Supabase에서 실행.**
- admin→abroad AI 추출: `EXTRACTION_API_URL`=abroad(3000). 토큰=`INTERNAL_API_TOKEN`(일치).
- 커밋은 로컬 자동, **push/배포는 명시 요청 시만**.
- abroad 비공개 버킷 `student-files` (서명·파일 업로드용).
