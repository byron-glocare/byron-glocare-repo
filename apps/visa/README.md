# visa — 한국 유학비자 발급요건 조회 사이트

로그인·DB 없는 **단순 조회 사이트**. `docs/visa requirement/rules.json`(룰 엔진 단일 진실원본)을
그대로 소비해서, 신청 상황(13개 축) 선택 → 적용 발급요건 조항을 실시간 판정한다.

> ⚠️ 원본 프로젝트 원칙: **미확인은 요건 없음(면제)으로 폴백하지 않는다.** confidence가
> `confirmed` 가 아닌 조항은 확정 안내로 쓰면 안 되며, UI에도 미확정 건수가 표시된다.

## 실행

```bash
# 모노레포 루트에서
npm run dev:visa       # http://localhost:3003
npm run build:visa
```

## 구조

- `src/data/rules.json` — **정본 데이터.** `docs/visa requirement/rules.json` 의 복사본.
- `src/data/engine.ts` — 룰 엔진(TS 포트). `resolve(input)` = 파생축 계산(`derive`) + 조항 매칭(`when`/`whenNot`).
  매칭 규칙은 원본 `test_rules.py` 와 동일하게 유지해야 한다.
- `src/app/page.tsx` — 조회 UI 전체(입력 폼 · 결과 그룹 · 확신도/출처 표시). 클라이언트 컴포넌트.

## 데이터 갱신

원본이 바뀌면 룰셋만 다시 복사하면 된다(빌드/코드 변경 불필요):

```bash
cp "docs/visa requirement/rules.json" apps/visa/src/data/rules.json
```

원본 룰셋 편집·검증 절차(build.py / test_rules.py / verify.py)는 `docs/visa requirement/` 참고.
축·조항 구조(키 이름)가 바뀌면 `src/data/engine.ts` 의 타입도 함께 손봐야 한다.
