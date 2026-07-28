# visa — 한국 유학비자 발급요건 조회 사이트

로그인·DB 없는 **단순 조회 사이트**. 신청 상황을 4가지만 고르고 [조회]하면 적용 발급요건을
서류(문서) 중심으로 정리해 보여준다.

> ⚠️ 원본 원칙: **미확인은 요건 없음/면제로 폴백하지 않는다.** confidence≠confirmed 조항은
> 확정 안내로 쓰지 말 것 — UI에 "미확정" 배지·건수로 표시된다.

## 실행
```bash
npm run dev:visa      # http://localhost:3003 (루트에서)
npm run build:visa
```

## 조회 모델
- **입력 4축**(상단 폼): 현재상태·희망비자(track) / 국적·거주지(nationality+applicantRegion 병합) /
  지원할 대학교(→ univTier+univRegion 자동) / 신청할 비자(statusCode). 조회하면 폼은 요약바로 접힘.
- **옵션축**(장학금·재정보증인·체류기간·졸업서류·수학언어·통화 등)은 입력받지 않고, 결과에서
  각 조항을 가르는 **조건 태그**로 노출. 같은 서류(doc)면 한 카드로 묶고 조건만 태그로 구분.

## 데이터 / 코드
- `src/data/rules.json` — **정본 룰셋**(원본 `docs/visa requirement/rules.json` 복사본). 원본 갱신 시:
  ```bash
  cp "docs/visa requirement/rules.json" apps/visa/src/data/rules.json
  ```
- `src/data/engine.ts` — 룰엔진(TS 포트, `resolve`/`derive`/`matches`는 원본 test_rules.py와 동일) +
  v2 조회 어댑터(`lookup`: 4입력→후보조항+옵션태그, `ORIGIN_OPTIONS`, finProof 도달집합 계산).
- `src/data/annotations.ts` — **주석층(수작업)**. 조항 id→{terse(간결 표현), title, doc(그룹키)}.
  원본 rules.json은 안 건드리고 표시용만 여기서 가공.
- `src/data/universities.ts` — 인증대학 184교 {name, region(metro/nonmetro), tier, lang}.
  studyinkorea 인증목록(등급) + 소재지 조사 결과. 생성: `scratchpad/gen_universities.mjs`.
- `src/app/page.tsx` — 2-state 조회 UI + 문서중심 결과.

## 알려진 갭
- 대학 등급 중 `consulting`(컨설팅)·`restricted`(비자정밀심사)는 studyinkorea·소재지 출처에 없어
  대학 개별 매핑 불가 → 피커에서 "특수 등급" 수동 선택으로만 제공. 별도 MOE 고시 확보 시 보강.
