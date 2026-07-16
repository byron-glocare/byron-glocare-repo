/**
 * 빈칸에 붙일 수 있는 "값 출처(binding)" 카탈로그 + 테스트 값 생성.
 *
 * 토큰은 아무거나가 아니라 반드시 출처에 묶인다:
 *   1) 표준데이터  — study_student_data_types 의 key (학생 정보에서 옴)
 *   2) 날짜 파생   — date 항목의 _year/_month/_day (한국 양식은 년/월/일을 칸칸이 쪼갬)
 *   3) 작성일      — today / today_year / today_month / today_day
 *   4) 이미지      — 사진·서명
 *   5) 직접 입력   — "lit:<값>" (그 양식에만 있는 값)
 */

export type CatalogRow = {
  key: string;
  label_ko: string;
  category: string;
  input_type: string;
};

export type BindingOption = {
  /** 슬롯 매핑에 쓰는 토큰 */
  token: string;
  label: string;
  group: string;
  kind: "text" | "image";
};

/** 테스트용 고정 생년월일 — 년/월/일 파생 확인용 */
const TEST_DATE = "2005-03-15";

/** 양식에 직접 박히는 이미지(사진·서명) 판별 */
export function isImageType(d: CatalogRow): boolean {
  if (d.input_type === "signature") return true;
  return (
    d.input_type === "file" &&
    /사진|photo|서명|signature|도장|stamp/i.test(`${d.key} ${d.label_ko}`)
  );
}

/** 이미지 토큰이 서명 계열인지(아니면 사진) */
export function isSignatureToken(token: string, label: string): boolean {
  return /서명|signature|도장|stamp/i.test(`${token} ${label}`);
}

export function buildBindings(
  types: CatalogRow[],
  now: Date = new Date()
): { options: BindingOption[]; values: Record<string, string> } {
  const options: BindingOption[] = [];
  const values: Record<string, string> = {};

  // 1) 작성일 + 파생 — "____년 ____월 ____일" 케이스의 핵심
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1);
  const d = String(now.getDate());
  values.today = `${y}년 ${m}월 ${d}일`;
  values.today_year = y;
  values.today_month = m;
  values.today_day = d;
  options.push(
    { token: "today", label: "작성일 (전체)", group: "작성일", kind: "text" },
    { token: "today_year", label: "작성일 — 년", group: "작성일", kind: "text" },
    { token: "today_month", label: "작성일 — 월", group: "작성일", kind: "text" },
    { token: "today_day", label: "작성일 — 일", group: "작성일", kind: "text" }
  );

  // 2) 표준데이터
  for (const t of types) {
    if (isImageType(t)) {
      options.push({
        token: t.key,
        label: t.label_ko,
        group: "이미지",
        kind: "image",
      });
      continue;
    }
    // 발급서류 첨부(졸업증명서 등)는 양식에 박히는 값이 아님 → 제외
    if (t.input_type === "file") continue;

    if (t.input_type === "date") {
      values[t.key] = TEST_DATE;
      const [yy, mm, dd] = TEST_DATE.split("-");
      values[`${t.key}_year`] = yy;
      values[`${t.key}_month`] = mm;
      values[`${t.key}_day`] = dd;
      options.push(
        { token: t.key, label: `${t.label_ko} (전체)`, group: t.category, kind: "text" },
        { token: `${t.key}_year`, label: `${t.label_ko} — 년`, group: t.category, kind: "text" },
        { token: `${t.key}_month`, label: `${t.label_ko} — 월`, group: t.category, kind: "text" },
        { token: `${t.key}_day`, label: `${t.label_ko} — 일`, group: t.category, kind: "text" }
      );
      continue;
    }

    values[t.key] = `테스트${t.label_ko}`;
    options.push({
      token: t.key,
      label: t.label_ko,
      group: t.category,
      kind: "text",
    });
  }

  return { options, values };
}
