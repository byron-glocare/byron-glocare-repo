# 인수인계 — 작성서류(DOCX) 자동 채움 "100%" 도전

> 이 문서 하나로 새 채팅에서 이 작업만 독립적으로 이어갈 수 있게 정리한 것.
> 다른 기능(B2C 유학지원·가이드 등)과 무관하게 **양식 채움 정확도**에만 집중한다.

## 목표
한국 대학 입학 양식(주로 DOCX, 표+빈칸)에 학생 정보를 **사람이 손댈 필요 없이** 채운다.
- 서명이 제 위치에 들어가야 하고,
- "지원자 : ____ (인)", "____년 __월 __일" 처럼 **한 칸/문단 안에 다른 텍스트와 섞인 빈칸**도
  주변 글자를 보존한 채 그 자리에만 채워야 한다.
- 운영자(글로케어)가 양식당 1회 셋업하는 것은 허용. 학생마다는 완전 자동.

## 지금까지 (배포됨, 커밋 `ff254e1`)
어드민 `시스템 → 양식 채움 테스트` (`/test/form-fill`). **웹 클릭 바인딩 방식**:
1. DOCX 업로드 → 빈칸 탐지(`/test/form-fill/scan`)
2. 브라우저 렌더(docx-preview)에서 빈칸을 노란 칩으로 → 클릭
3. 드롭다운으로 값 출처 연결(표준데이터 / 날짜 파생 / 직접입력 / 이미지)
4. 채우기(`/test/form-fill/fill`) → 미리보기·다운로드. Word 편집 불필요.

### 핵심 파일
- `apps/admin/src/lib/docx/inline-slots.ts` — **문자 단위 빈칸 탐지·채움 엔진**(핵심).
  - `markInlineSlots(xml)`: `<w:t>` 안의 밑줄런·연속공백(3+) + 빈 셀을 각각 독립 슬롯으로 탐지.
  - `fillSlots(xml, slots, resolve)`: 값은 원래 빈칸 너비로 가운데 패딩(레이아웃 보존).
    이미지 슬롯은 런을 [앞][토큰][뒤]로 분리해 주입(image module 이 런 전체를 교체해
    주변 텍스트를 삼키는 함정 회피, rPr 서식 승계). 미매핑은 원복.
  - `scanDocxSlots(buf)` / `fillDocxSlots(buf, resolve)`.
- `apps/admin/src/lib/test/bindings.ts` — 토큰을 값 출처에 묶는 카탈로그(표준데이터 +
  **날짜 파생 `_year/_month/_day`** + 작성일 `today*` + 이미지 + 직접입력 `lit:`).
- `apps/admin/src/app/(app)/test/form-fill/{page,test-form-fill,scan/route,fill/route}.tsx`
- 이미지 채움은 `docxtemplater` + `docxtemplater-image-module-free` + `image-size`
  (delimiters `{{ }}`). 서명/사진 테스트 이미지는 `apps/admin/templates/test-signature.png`,
  `test-photo.png`.

### 검증됨(합성 docx 단위 테스트)
- "____년 __월 __일" → 각각 독립 탐지, 값은 칸 너비만큼 패딩되어 채워짐.
- "지원자 :[서명] (인)" → `(인)`·굵게 서식 보존한 채 서명 이미지 삽입.
- 표 셀 안/밖 문단 모두 동작.

## 알려진 한계 (여기서부터 개선 필요)
- **탭(`<w:tab/>`) 으로 만든 빈칸은 못 잡음** — 공백·밑줄·빈 셀만 탐지. 한국 양식이 탭을 자주 씀.
- **여러 런으로 쪼개진 빈칸**(Word 가 서식 때문에 나눔)은 일부 놓칠 수 있음.
- **실제 동남보건대 입학원서로의 end-to-end 검증 미완** — 운영자 실사용 피드백 필요.
- 원본 파일은 Supabase 스토리지(`admission-form-files` 버킷, `study_admission_form_files`).
  프로덕션 DB 직접 조회는 권한 가드에 막히니, 파일은 어드민에서 다운로드해 테스트 메뉴에 업로드.

## 대안(막히면 검토) — 이전 논의 결론
- **방식 B: DOCX→PDF 렌더 후 좌표 오버레이.** 편집 불가/스캔 양식엔 이게 유일. 단 Vercel 에
  LibreOffice 가 없어 서버 렌더가 어려움. PDF 좌표 오버레이 엔진은 이미 있음(field_overlays).
- 편집 가능 양식 = inline-slots(방식 A), 스캔/그림 양식 = 좌표(방식 B) **하이브리드**가 실전 정답.

## 시작 방법 (새 채팅)
1. 이 문서를 먼저 읽는다.
2. 로컬 dev: `apps/admin` 에서 `npm run dev` (포트 3001). 어드민 `시스템 → 양식 채움 테스트`.
   (운영자가 브라우저에서 확인 — 관리형 preview 는 이 환경에서 자주 얼어붙음.)
3. 동남보건대 입학원서를 업로드해 실제로 어디가 안 잡히는지부터 확인 → 탭/분산 런 탐지 보강.

관련 메모리(원인 히스토리): "70% 천장의 정체 = 기존 injectSlotMarkers 가 셀 단위였음".
