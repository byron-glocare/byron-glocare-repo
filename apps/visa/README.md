# visa — 한국 비자 발급 요건 조회 사이트

로그인·DB 없는 **단순 정적 조회 사이트**. 체류자격(비자)별 자격요건·제출서류·신청절차를
검색/필터로 보여준다. 데이터는 코드에 번들된 정적 파일 하나(`src/data/visas.ts`)가 정본.

## 실행

```bash
# 모노레포 루트에서
npm run dev:visa       # http://localhost:3003
npm run build:visa
```

## 구조

- `src/app/page.tsx` — 조회 UI 전체(검색·카테고리 필터·카드·상세 모달). 클라이언트 컴포넌트.
- `src/data/types.ts` — 비자 데이터 타입(형태) 정의.
- `src/data/visas.ts` — **정본 데이터**. 현재는 예시(샘플)이며 `IS_SAMPLE_DATA=true` 라 상단에 안내 배너가 뜬다.
- `scripts/import-visas.mjs` — CSV → `visas.ts` 변환기.

## 데이터 갱신 방법

1. `docs/visa requirement/_비자데이터_템플릿.csv` 를 채운다(비자 1개 = 1행).
   여러 항목(요건/서류/절차)은 한 셀 안에서 줄바꿈 또는 ` | ` 로 구분.
2. 변환 실행:
   ```bash
   node apps/visa/scripts/import-visas.mjs "docs/visa requirement/visas.csv"
   ```
3. `visas.ts` 가 교체되고 `IS_SAMPLE_DATA=false` 가 되어 샘플 배너가 사라진다.

> CSV가 아니어도 됨 — PDF·한글(hwp/hwpx)·워드·엑셀 원본을 `docs/visa requirement/` 에
> 넣어주면 그걸 파싱해 `visas.ts`(또는 CSV)로 변환한다.
