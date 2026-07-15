/**
 * 양식 채움 테스트용 표준 토큰 사전 + 테스트 학생 데이터.
 *
 * 접근법(방식 A — in-place 템플릿):
 *   운영자가 원본 DOCX(예: 동남보건대 입학원서)를 Word 로 열어, 값이 들어갈
 *   빈칸을 아래 {{토큰}} 으로 "최초 1회" 치환해 둔다. 이후 학생마다는 시스템이
 *   토큰을 실제 값으로 결정론적으로 채운다 → 원본 서식 100% 유지.
 *
 *   - 텍스트 빈칸: {{name_ko}} 처럼 이중 중괄호.
 *   - 이미지(사진/서명): {{%photo}} · {{%signature}} (image module + 이중 중괄호).
 */

export type TokenDef = { token: string; label: string; sample: string };

/** 텍스트 토큰 — 입학원서 공통 필드. 값에 "테스트"를 넣어 실데이터와 구분. */
export const TEXT_TOKENS: TokenDef[] = [
  { token: "name_ko", label: "한국어 성명", sample: "테스트학생" },
  { token: "name_en", label: "영문 성명", sample: "TEST STUDENT" },
  { token: "name_vi", label: "본국(자국) 성명", sample: "TEST SINH VIEN" },
  { token: "birth", label: "생년월일", sample: "2005-03-15(테스트)" },
  { token: "gender", label: "성별", sample: "남(테스트)" },
  { token: "nationality", label: "국적", sample: "베트남(테스트)" },
  { token: "birth_country", label: "출생국가", sample: "베트남(테스트)" },
  { token: "passport_no", label: "여권번호", sample: "TEST12345678" },
  { token: "passport_expiry", label: "여권 유효기간", sample: "2030-12-31(테스트)" },
  { token: "alien_reg_no", label: "외국인등록번호", sample: "000000-0000000(테스트)" },
  { token: "visa_status", label: "체류자격", sample: "D-4(테스트)" },
  { token: "visa_expiry", label: "체류자격 만료일", sample: "2027-02-28(테스트)" },
  { token: "phone_kr", label: "한국 연락처", sample: "010-0000-0000(테스트)" },
  { token: "phone_home", label: "본국 연락처", sample: "+84-00-000-0000(테스트)" },
  { token: "email", label: "이메일", sample: "test@test.com" },
  { token: "address_home", label: "본국 주소", sample: "테스트 주소, 하노이(TEST)" },
  { token: "department", label: "지원 학과", sample: "테스트간호학과" },
  { token: "topik_level", label: "TOPIK 등급", sample: "3급(테스트)" },
  { token: "korean_edu", label: "국내 한국어교육 경력", sample: "테스트 어학당 6개월" },
  { token: "guardian_name", label: "보호자 성명", sample: "테스트보호자" },
  { token: "guardian_relation", label: "보호자 관계", sample: "부(테스트)" },
  { token: "guardian_phone", label: "보호자 연락처", sample: "+84-00-000-0000(테스트)" },
  { token: "edu_highschool", label: "출신 고등학교", sample: "테스트고등학교" },
  { token: "today", label: "작성일(오늘)", sample: "(자동: 오늘 날짜)" },
];

/** 이미지 토큰 — {%...} 문법. */
export const IMAGE_TOKENS: TokenDef[] = [
  { token: "photo", label: "증명사진", sample: "(테스트 사진 이미지)" },
  { token: "signature", label: "서명", sample: "(테스트 서명 이미지)" },
];

/** 오늘 날짜 한국어 표기. */
export function todayKo(now: Date = new Date()): string {
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
}

/** 채움용 텍스트 데이터 (토큰 → 값). today 만 실시간. */
export function buildTestData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const t of TEXT_TOKENS) {
    data[t.token] = t.token === "today" ? todayKo() : t.sample;
  }
  return data;
}
