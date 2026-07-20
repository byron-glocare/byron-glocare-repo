# 유학센터 담당자 가이드 — 제작 파이프라인

`youstudyinkorea.com/center`(유학센터 포털) 사용자 가이드를 **스크린샷 캡처 → docx 빌드 → 베트남어판 생성**까지 자동화한 도구.

> ⚠ **이 폴더는 반드시 레포에 유지할 것.** 예전에 이 빌더를 세션 임시폴더(스크래치패드)에
> 두었다가 통째로 사라져서, 55p 가이드를 처음부터 다시 만들어야 했다.

## 산출물

| 파일 (`docs/`) | 내용 |
|---|---|
| `글로케어_유학센터_담당자_가이드.docx` | 설명=한국어 |
| `글로케어_유학센터_담당자_가이드_VN.docx` | 설명=베트남어 (현지 배포용) |

**두 버전 모두 스크린샷은 베트남어 화면**(센터 기본 언어가 vi)이고, 설명 텍스트만 다르다.

## 사용법

```bash
cd docs/guide-builder
npm install

# 1) 스크린샷 (아래 "캡처 준비" 먼저)
node shoot.js              # 전체
node shoot.js c62          # 이름에 c62 포함된 것만
node shoot.js sample       # 앞 3장만 (품질 확인용)

# 2) 문서 빌드
node build.js              # 한국어판 → out/guide_center.docx
LANG_OUT=vi node build.js  # 베트남어판 → out/guide_center_vi.docx

# 3) 번역 사전 갱신 (build.js 문구를 고쳤을 때)
node extract.js            # build.js → strings.json (한국어 문자열 추출)
AKEY=<ANTHROPIC_API_KEY> node translate.js   # strings.json → vi.json
```

`build.js` 는 빌드 후 **사전에 없어 한국어로 남은 문자열**을 경고로 출력한다. 그게 뜨면
`extract` → `translate` 를 다시 돌리거나 `vi.json` 을 직접 손보면 된다.

### 캡처 준비 (로그인은 사람이 직접)

MCP 스크린샷은 디스크에 파일을 남기지 않는다 → **puppeteer-core + 시스템 Chrome 원격디버깅**을 쓴다.

```powershell
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList @(
  "--remote-debugging-port=9222",
  "--user-data-dir=<전용 프로필 경로>",
  "--no-first-run","--no-default-browser-check","--window-size=1440,960",
  "https://www.youstudyinkorea.com/center/login")
```

띄운 창에서 **운영자가 직접 로그인**한다(비밀번호는 AI 가 입력하지 않는다). 세션은 전용
프로필에 남아 이후 자유롭게 이동·캡처 가능. Git Bash 백그라운드(`&`)로는 잘 안 붙으니
**PowerShell `Start-Process`** 를 쓸 것.

## 캡처 규칙 (시행착오로 확정된 것 — 바꾸지 말 것)

- **fullPage(dsf3) 캡처 → sharp 좌표 크롭**으로 통일. **요소캡처·`.trim()` 금지** (짤림 원인이었음).
- 센터 화면: `<main>` boundingRect 기준 크롭 (좌우 ±16px, top=main 시작 → 헤더 제거).
- 하단 흰 여백은 `main` 내부 요소들의 최대 bottom 을 재서 잘라낸다(좌표 기반).
- **dsf3 fullPage 가 16384px 를 넘으면 오염**된다 → 자동으로 dsf2 재촬영 (`MAX_DEV_PX`).
- 초장신 페이지(정보 입력 등)는 `cropRatio` 로 상단만. 특정 기능 클로즈업은 `band` 옵션
  (텍스트로 요소를 찾아 그 주변 띠만 크롭).
- 화면 언어는 **베트남어**(쿠키를 건드리지 않으면 기본 vi). 한국어 화면이 필요하면 `locale=ko` 쿠키.

## docx 규칙 (Word 호환 — 어기면 파일이 안 열리거나 깨짐)

- `ImageRun` 에 **`outline` 넣지 말 것** → MS Word 가 "파일 열 때 오류"로 거부한다.
- `Table` 은 `width` + `columnWidths` + `layout: FIXED` + 셀 `width` 를 **전부** 지정.
  안 그러면 Word 에서 표가 접혀 "긴 작대기"로 보인다.
- 번호목록은 **절차마다 새 numbering reference** (재사용하면 문서 전체에서 번호가 누적된다).
- **`TableOfContents` 금지** — Word 가 열 때 필드 업데이트 대화상자를 띄워 COM 자동화가 멈춘다.
  목차는 정적 목록으로 넣는다.
- 세로가 콘텐츠 폭의 **1.2배를 넘으면 조각으로 분할**(4% 겹침 + "⌄ 아래로 이어짐").
  한 장으로 축소하면 글씨가 안 보인다.
- 폰트 `맑은 고딕`. **폰트명은 번역 사전에서 제외**할 것(번역되면 한글이 깨진다).

## 예시 데이터

- 예시 학생 = **테스트학생** `322138e1-e789-45ab-b550-a29666720d95`
  (`Nguyen Van Test`, 가짜 연락처). 지원 2건·정보입력 41/42·서류 일부 업로드로 모든 기능이 드러난다.
  **실제 학생으로 찍지 말 것** — 가이드는 외부 파트너 센터에 배포된다.

## 알려진 제약

- **Word COM 으로 docx→PDF 변환이 무한 대기**에 걸린다(원인 미해결). TOC 제거·경로 변경 모두
  시도했으나 동일. PDF 가 필요하면 Word 에서 수동으로 "다른 이름으로 저장 → PDF".
- 문서 구조 검증은 `pizzip` 으로 가능: 이미지 수, `<w:tbl>` 수, `a:ln`(outline) 유무,
  남은 한국어 텍스트런 등을 확인한다.
