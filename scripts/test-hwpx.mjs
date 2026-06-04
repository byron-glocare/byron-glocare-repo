/**
 * HWPX 출력 호환성 테스트 — @ssabrojs/hwpxjs 의 markdownToHwpx 가
 * 한컴오피스에서 정상 열리는지 검증용.
 *
 * 실행:  node scripts/test-hwpx.mjs
 * 결과:  scripts/test-output.hwpx
 *
 * 검증 포인트:
 *   - 한글 제목/본문 폰트 렌더
 *   - 마크다운 표 → HWPX 표 변환
 *   - 단락 줄바꿈 보존
 *   - 한컴오피스로 열기 (또는 네이버 한컴독스: hancomdocs.com)
 */

import { markdownToHwpx } from "@ssabrojs/hwpxjs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const md = `# 2026학년도 외국인 특별전형 입학원서

**대학교**: 동남보건대학교 (글로벌요양복지과)
**학생**: 응웬 반 안 (Nguyen Van Anh)
**작성일**: ${new Date().toISOString().slice(0, 10)}

---

## 신원 정보

| 항목 | 값 |
|---|---|
| 한국식 이름 | 응웬 반 안 |
| 영문 이름 | NGUYEN VAN ANH |
| 베트남식 이름 | Nguyễn Văn Anh |
| 한자 이름 | 阮文英 |
| 생년월일 | 2005-03-15 |
| 성별 | 남성 |
| 국적 | 베트남 |
| 여권 번호 | C12345678 |
| 여권 발급일 | 2023-01-20 |
| 여권 만료일 | 2033-01-19 |
| 베트남 거주 도시 | 호치민시 |
| 베트남 거주 주소 | Quận 1, TP. Hồ Chí Minh, Việt Nam |

## 학력

| 항목 | 값 |
|---|---|
| 고등학교 이름 | Trường THPT Lê Quý Đôn |
| 고등학교 소재지 | 호치민시, 베트남 |
| 고등학교 졸업일 | 2023-06-30 |
| 고등학교 GPA | 8.5 |
| GPA 만점 | 10점 만점 |

## 가족

| 항목 | 값 |
|---|---|
| 아버지 이름 | Nguyễn Văn Bình |
| 아버지 직업 | 회사원 |
| 아버지 연락처 | +84 90 1234 5678 |
| 어머니 이름 | Trần Thị Hoa |
| 어머니 직업 | 교사 |
| 어머니 연락처 | +84 90 8765 4321 |
| 형제자매 수 | 1 |

## 재정

| 항목 | 값 |
|---|---|
| 재정보증인 이름 | Nguyễn Văn Bình |
| 보증인 관계 | 아버지 |
| 보증인 직업 | 회사원 |
| 은행명 | Vietcombank |
| 잔고 (KRW 환산) | 22,000,000 |
| 잔고증명서 발급일 | 2026-05-20 |

## 어학 능력

| 항목 | 값 |
|---|---|
| TOPIK 등급 | 4급 |
| TOPIK 점수 | 220 |
| TOPIK 응시일 | 2026-04-15 |

## 연락처

| 항목 | 값 |
|---|---|
| 학생 전화번호 | +84 90 1111 2222 |
| 학생 이메일 | nguyenvananh@gmail.com |
| Zalo ID | nguyenvananh.vn |

---

## 서술형 답변

### 1. 한국 유학을 결심하게 된 계기는 무엇입니까?

_(최대 500자)_

저는 고등학교 1학년 때 처음 한국 드라마를 접하면서 한국에 관심을 갖게 되었습니다. 특히 한국의 의료 시스템과 노인 돌봄 문화를 다룬 다큐멘터리를 본 후, 베트남에서도 빠르게 진행되는 고령화 사회 문제에 한국의 경험을 적용해보고 싶다는 생각을 하게 되었습니다.

한국어를 독학으로 공부하기 시작했고, 2년간 매일 2시간씩 꾸준히 학습하여 작년 TOPIK 4급을 취득했습니다. 한국에서 직접 요양복지를 공부하고, 졸업 후에는 한국의 선진 시스템을 베트남에 도입하는 가교 역할을 하고 싶습니다.

### 2. 본교 글로벌요양복지과를 지원한 이유는?

_(최대 400자)_

동남보건대학교의 글로벌요양복지과는 외국인 유학생에게 특화된 프로그램을 제공하며, 졸업 후 E-7 비자 취득과 한국 내 취업까지 연계되는 점이 매우 매력적이었습니다. 또한 실습 위주의 커리큘럼이 강점이라고 들었습니다.

저는 2년간의 학업을 통해 한국 요양 시설에서의 실무 경험을 쌓고, 베트남으로 돌아가 한국형 요양복지 모델을 도입하는 사업을 꿈꾸고 있습니다.

### 3. 입학 후 학업 계획을 서술하시오.

_(최대 600자)_

**1학년 1학기**: 한국어 능력 향상 (TOPIK 5급 목표) 및 기초 의학 용어 습득.
**1학년 2학기**: 노인 심리학, 요양 기초 실습 과목 집중.
**2학년 1학기**: 한국 요양 시설 현장 실습 + 자격증 준비.
**2학년 2학기**: 졸업 논문 및 한국 또는 베트남 요양 시설 인턴십.

학업 외에 한국어 동아리, 베트남 유학생 자치회에서 활동하며 한국 문화와 베트남 문화 간 교류 프로그램을 기획해보고 싶습니다.

---

_본 문서는 GLOCARE 시스템에서 자동 생성되었습니다. 실제 학교 양식에 옮겨 입력하시기 바랍니다._
`;

console.log("Markdown 길이:", md.length, "자");
console.log("HWPX 생성 중...");

try {
  const bytes = await markdownToHwpx(md, {
    title: "응웬 반 안 - 입학원서 작성 시트 (테스트)",
    creator: "GLOCARE",
  });

  const outPath = join(__dirname, "test-output.hwpx");
  await writeFile(outPath, bytes);

  console.log(`✅ HWPX 저장 완료: ${outPath}`);
  console.log(`   파일 크기: ${(bytes.length / 1024).toFixed(1)} KB`);
  console.log(``);
  console.log(`다음 단계:`);
  console.log(`  1. 한컴오피스로 열기 — 위 파일 더블클릭`);
  console.log(`     또는 네이버 한컴독스 — https://hancomdocs.com 에서 열기`);
  console.log(`  2. 확인 항목:`);
  console.log(`     - 한글 제목 / 본문 폰트 정상`);
  console.log(`     - 9개 카테고리 표 모두 렌더`);
  console.log(`     - 표 안 한국어 정상`);
  console.log(`     - 서술형 답변 단락 줄바꿈 보존`);
  console.log(`     - 베트남어 (Trần Thị Hoa) 글자 깨짐 여부`);
} catch (e) {
  console.error("❌ HWPX 생성 실패:", e);
  process.exit(1);
}
