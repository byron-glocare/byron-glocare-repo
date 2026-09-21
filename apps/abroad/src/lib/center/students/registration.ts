/**
 * 센터 학생 등록(개별 폼 · 엑셀 일괄) 공용 — 입력 칸 정의 · 값 정규화 · 필수 검사.
 *
 *   칸 목록과 **필수 여부의 정본은 `lib/center/student-roster-columns.ts`** (운영자 엑셀 양식).
 *   여기서는 그 정의를 "입력 칸(field)" 단위로 풀어 쓴다:
 *     · 이름(special "name")                → field "name"
 *     · 데이터 항목 칸(key)                 → field = key
 *     · 최종 졸업학교/입학일자/졸업일자       → 폼은 고교·대학 칸을 따로 받는다
 *                                             (엑셀은 finalEducationKeys(level) 로 풀어서 넣는다)
 *     · 결석 합계·월수입 합계                → 계산값 (저장 안 함)
 *
 *   필수 칸을 바꾸려면 student-roster-columns.ts 의 `required` 만 고치면 된다.
 *   이 파일은 서버·클라이언트 공용 (server-only 아님).
 */

import { tr, type Locale } from "@/lib/i18n";
import type { Json } from "@/types/database";

import {
  ROSTER_INPUT_COLUMNS,
  finalEducationKeys,
  normalizeYesNo,
  type RosterColumn,
} from "@/lib/center/student-roster-columns";

export type FieldInput = "text" | "date" | "number" | "select" | "yesno";

export type RegField = {
  /** 폼 name / 정규화 결과 키. "name" 외에는 데이터 항목 키와 같다 */
  id: string;
  ko: string;
  vi: string;
  input: FieldInput;
  required: boolean;
};

/** "한국어 / Tiếng Việt" → { ko, vi } */
export function splitLabel(text: string): { ko: string; vi: string } {
  const idx = text.indexOf(" / ");
  if (idx < 0) return { ko: text.trim(), vi: text.trim() };
  return { ko: text.slice(0, idx).trim(), vi: text.slice(idx + 3).trim() };
}

/** 칸 라벨 (그룹 + 하위) — "전화번호 (학생)" / "SĐT (Học sinh)" */
export function columnLabel(c: RosterColumn): { ko: string; vi: string } {
  const g = splitLabel(c.group);
  if (!c.sub) return g;
  const s = splitLabel(c.sub);
  return { ko: `${g.ko} (${s.ko})`, vi: `${g.vi} (${s.vi})` };
}

/** 최종학력 칸이 풀어지는 고교·대학 항목 (폼 전용 라벨) */
const EDUCATION_FIELDS: RegField[] = [
  { id: "highschool_name", ko: "고등학교 이름", vi: "Tên trường THPT", input: "text", required: false },
  { id: "high_school_admission_date", ko: "고교 입학일", vi: "Ngày nhập học THPT", input: "date", required: false },
  { id: "highschool_grad_date", ko: "고교 졸업일", vi: "Ngày tốt nghiệp THPT", input: "date", required: false },
  { id: "bachelor_university", ko: "대학(전문대) 이름", vi: "Tên trường CĐ / ĐH", input: "text", required: false },
  { id: "bachelor_admission_date", ko: "대학 입학일", vi: "Ngày nhập học CĐ / ĐH", input: "date", required: false },
  { id: "bachelor_grad_date", ko: "대학 졸업일", vi: "Ngày tốt nghiệp CĐ / ĐH", input: "date", required: false },
];

/** 대학·전문대 졸업자에게만 받는 칸 */
export const BACHELOR_FIELD_IDS = [
  "bachelor_university",
  "bachelor_admission_date",
  "bachelor_grad_date",
  "final_education_score",
] as const;

/** 입력 칸 전체 (id → 정의). 컬럼 정의에서 자동 생성 */
export const REG_FIELDS: Record<string, RegField> = (() => {
  const out: Record<string, RegField> = {};
  for (const c of ROSTER_INPUT_COLUMNS) {
    const label = columnLabel(c);
    if (c.special === "name") {
      out.name = { id: "name", ...label, input: "text", required: !!c.required };
    } else if (c.key) {
      out[c.key] = { id: c.key, ...label, input: c.input ?? "text", required: !!c.required };
    }
  }
  for (const f of EDUCATION_FIELDS) out[f.id] = f;
  return out;
})();

/** 필수 칸 id — 정본은 student-roster-columns.ts 의 required */
export const REQUIRED_FIELD_IDS: string[] = Object.values(REG_FIELDS)
  .filter((f) => f.required)
  .map((f) => f.id);

/** 등록 화면 섹션 구성 (칸 id 순서) */
export const REG_SECTIONS: Array<{ id: string; ko: string; vi: string; fields: string[] }> = [
  {
    id: "basic",
    ko: "기본 정보",
    vi: "Thông tin cơ bản",
    fields: ["name", "full_name_en", "gender", "birth_date", "desired_visa_type", "desired_term", "korea_visa_history"],
  },
  {
    id: "passport",
    ko: "여권 · 신분증",
    vi: "Hộ chiếu · CCCD",
    fields: ["passport_no", "passport_issued", "passport_expiry", "national_id_no"],
  },
  {
    id: "education",
    ko: "학력",
    vi: "Học vấn",
    fields: [
      "final_education_level",
      "highschool_name",
      "high_school_admission_date",
      "highschool_grad_date",
      "hs_grade_1",
      "hs_grade_2",
      "hs_grade_3",
      "highschool_gpa",
      "hs_absence_1",
      "hs_absence_2",
      "hs_absence_3",
      ...BACHELOR_FIELD_IDS,
    ],
  },
  {
    id: "contact",
    ko: "연락처 · 주소",
    vi: "Liên hệ · Địa chỉ",
    fields: ["student_phone", "student_email", "residence_city_vn", "home_province", "home_district", "home_ward"],
  },
  {
    id: "family",
    ko: "가족",
    vi: "Gia đình",
    fields: [
      "father_contact",
      "mother_contact",
      "father_national_id",
      "mother_national_id",
      "father_occupation",
      "mother_occupation",
      "has_family_in_korea",
    ],
  },
  {
    id: "finance",
    ko: "재정",
    vi: "Tài chính",
    fields: ["father_monthly_income", "mother_monthly_income", "has_bank_balance_cert"],
  },
  {
    id: "korean",
    ko: "한국어",
    vi: "Tiếng Hàn",
    fields: ["topik_level", "language_cert_valid_until"],
  },
];

// ──────────────────────────────────────────────────────────────
// 선택지
// ──────────────────────────────────────────────────────────────

export type RegOption = { value: string; ko: string; vi: string };

export const GENDER_OPTIONS: RegOption[] = [
  { value: "male", ko: "남성", vi: "Nam" },
  { value: "female", ko: "여성", vi: "Nữ" },
];

/** 희망 비자 — 데이터 항목 desired_visa_type 선택지 (0069) */
export const DESIRED_VISA_OPTIONS: RegOption[] = [
  { value: "D-4", ko: "D-4 (어학연수)", vi: "D-4 (học tiếng)" },
  { value: "D-2", ko: "D-2 (학위과정)", vi: "D-2 (hệ chính quy)" },
  { value: "other", ko: "기타", vi: "Khác" },
];

export const EDUCATION_LEVEL_OPTIONS: RegOption[] = [
  { value: "high_school", ko: "고등학교 졸업", vi: "Tốt nghiệp THPT" },
  { value: "college", ko: "전문대 졸업", vi: "Tốt nghiệp cao đẳng" },
  { value: "university", ko: "대학 졸업", vi: "Tốt nghiệp đại học" },
];

export const TOPIK_OPTIONS: RegOption[] = ["1", "2", "3", "4", "5", "6"].map((n) => ({
  value: n,
  ko: `${n}급`,
  vi: `Cấp ${n}`,
}));

export const YESNO_OPTIONS: RegOption[] = [
  { value: "yes", ko: "있음", vi: "Có" },
  { value: "no", ko: "없음", vi: "Không" },
];

const TERM_SEASONS = ["Spring", "Summer", "Fall", "Winter"] as const;
const SEASON_LABEL: Record<(typeof TERM_SEASONS)[number], { ko: string; vi: string }> = {
  Spring: { ko: "봄", vi: "Xuân" },
  Summer: { ko: "여름", vi: "Hè" },
  Fall: { ko: "가을", vi: "Thu" },
  Winter: { ko: "겨울", vi: "Đông" },
};

/** 지원 학기 선택지 — (올해-1 ~ 올해+2) × 봄·여름·가을·겨울, 값 "2027-Spring" */
export function termOptions(now: Date = new Date()): RegOption[] {
  const y = now.getFullYear();
  const out: RegOption[] = [];
  for (let year = y - 1; year <= y + 2; year++) {
    for (const s of TERM_SEASONS) {
      out.push({
        value: `${year}-${s}`,
        ko: `${year} ${SEASON_LABEL[s].ko} (${s})`,
        vi: `${year} ${SEASON_LABEL[s].vi} (${s})`,
      });
    }
  }
  return out;
}

/** select 칸의 선택지 (지원 학기는 termOptions 로 따로) */
export function optionsFor(fieldId: string): RegOption[] | null {
  switch (fieldId) {
    case "gender":
      return GENDER_OPTIONS;
    case "desired_visa_type":
      return DESIRED_VISA_OPTIONS;
    case "final_education_level":
      return EDUCATION_LEVEL_OPTIONS;
    case "topik_level":
      return TOPIK_OPTIONS;
    default:
      return REG_FIELDS[fieldId]?.input === "yesno" ? YESNO_OPTIONS : null;
  }
}

// ──────────────────────────────────────────────────────────────
// 값 정규화
// ──────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function validYmd(y: number, m: number, d: number): string | null {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // 2/30 등
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** 날짜 → "YYYY-MM-DD". Date · 엑셀 일련번호 · YYYY-MM-DD · DD/MM/YYYY(베트남식) 허용 */
export function normalizeDate(v: unknown): string | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "invalid";
    return validYmd(v.getFullYear(), v.getMonth() + 1, v.getDate()) ?? "invalid";
  }
  if (typeof v === "number") {
    // 엑셀 날짜 일련번호 (1900 체계)
    if (v > 1000 && v < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return validYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) ?? "invalid";
    }
    return "invalid";
  }
  const s = String(v).trim();
  if (!s) return null;
  let m = /^(\d{4})[-./ ](\d{1,2})[-./ ](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return validYmd(+m[1], +m[2], +m[3]) ?? "invalid";
  m = /^(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{4})$/.exec(s);
  if (m) return validYmd(+m[3], +m[2], +m[1]) ?? "invalid";
  if (/^\d{5}$/.test(s)) return normalizeDate(Number(s));
  return "invalid";
}

/** 숫자 칸 — "8,5"(소수점 쉼표) · "15.000.000"/"15,000,000"(천 단위) 허용 */
export function normalizeNumber(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : "invalid";
  let s = String(v).trim().replace(/\s+/g, "");
  if (!s) return null;
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : "invalid";
}

export function normalizeGender(v: unknown): "male" | "female" | null | "invalid" {
  const s = str(v).toLowerCase();
  if (!s) return null;
  if (["male", "m", "nam", "남", "남자", "남성"].includes(s)) return "male";
  if (["female", "f", "nữ", "nu", "여", "여자", "여성"].includes(s)) return "female";
  return "invalid";
}

export function normalizeDesiredVisa(v: unknown): "D-4" | "D-2" | "other" | null | "invalid" {
  const s = str(v).toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  if (/^D-?4/.test(s)) return "D-4";
  if (/^D-?2/.test(s)) return "D-2";
  if (["OTHER", "기타", "KHÁC", "KHAC"].includes(s)) return "other";
  return "invalid";
}

export function normalizeTopik(v: unknown): string | null | "invalid" {
  const s = str(v).toLowerCase();
  if (!s || ["none", "없음", "chưa", "chưa có", "khong", "không", "-", "x"].includes(s)) return null;
  const m = /([1-6])/.exec(s);
  return m ? m[1] : "invalid";
}

export function normalizeEducationLevel(v: unknown): "high_school" | "college" | "university" | null | "invalid" {
  const s = str(v).toLowerCase();
  if (!s) return null;
  if (s === "high_school" || /고등|고졸|thpt|cấp\s*3|cap\s*3|high/.test(s)) return "high_school";
  if (s === "college" || /전문대|cao\s*đẳng|cao\s*dang|college/.test(s)) return "college";
  if (s === "university" || /대학|대졸|đại\s*học|dai\s*hoc|university|bachelor/.test(s)) return "university";
  return "invalid";
}

const TERM_SEASON_RE: Array<[RegExp, (typeof TERM_SEASONS)[number]]> = [
  [/spring|봄|xuân|xuan|1학기/i, "Spring"],
  [/summer|여름|hè|he\b|hạ/i, "Summer"],
  [/fall|autumn|가을|thu|2학기/i, "Fall"],
  [/winter|겨울|đông|dong/i, "Winter"],
];

/** 지원 학기 — "2027 봄" 등은 "2027-Spring" 으로 맞추고, 못 알아보면 적힌 그대로 */
export function normalizeTerm(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const y = /(20\d{2})/.exec(s);
  if (y) {
    for (const [re, season] of TERM_SEASON_RE) {
      if (re.test(s)) return `${y[1]}-${season}`;
    }
  }
  return s;
}

/** 엑셀에서 숫자로 읽혀 앞자리 0 이 빠진 전화번호·신분증 번호 복원 */
function restoreLeadingZero(fieldId: string, v: unknown): string {
  const s = str(v);
  if (typeof v !== "number") return s;
  const phoneKeys = ["student_phone", "father_contact", "mother_contact"];
  const idKeys = ["national_id_no", "father_national_id", "mother_national_id"];
  if (phoneKeys.includes(fieldId) && /^\d{9}$/.test(s)) return `0${s}`;
  if (idKeys.includes(fieldId) && /^\d{11}$/.test(s)) return `0${s}`;
  return s;
}

// ──────────────────────────────────────────────────────────────
// 등록 1건 정규화 + 검사
// ──────────────────────────────────────────────────────────────

export type RegistrationResult = {
  /** 칸 id → 오류 문구 (비어 있으면 통과) */
  errors: Record<string, string>;
  /** study_managed_students 에 들어갈 값 */
  student: {
    name: string;
    dob: string | null;
    phone: string | null;
    email: string | null;
    passport_no: string | null;
    topik_level: string | null;
  };
  /** study_student_data_values 에 저장할 값 (data_type_key → value) */
  values: Record<string, Json>;
};

export function fieldLabel(fieldId: string, locale: Locale): string {
  const f = REG_FIELDS[fieldId];
  if (!f) return fieldId;
  return tr(locale, f.ko, f.vi);
}

/**
 * 칸 id → 원시값 을 받아 정규화·검사한다. (폼 · 엑셀 공용)
 *   엑셀 쪽은 "최종 졸업학교/입학일자/졸업일자" 를 finalEducationKeys(level) 로 풀어 넣어서 호출.
 */
export function normalizeRegistration(
  raw: Record<string, unknown>,
  locale: Locale
): RegistrationResult {
  const errors: Record<string, string> = {};
  const values: Record<string, Json> = {};

  const invalidMsg = (id: string, hint: string) => {
    errors[id] = `${fieldLabel(id, locale)}: ${hint}`;
  };
  const dateHint = tr(locale, "날짜 형식이 아닙니다 (YYYY-MM-DD)", "Sai định dạng ngày (YYYY-MM-DD)");
  const numHint = tr(locale, "숫자를 입력하세요", "Vui lòng nhập số");
  const choiceHint = tr(locale, "선택지에 없는 값입니다", "Giá trị không hợp lệ");

  // 최종학력 → 대학 칸 사용 여부
  const levelRaw = normalizeEducationLevel(raw.final_education_level);
  const level = levelRaw === "invalid" ? null : levelRaw;
  const usesBachelor = level === "college" || level === "university";

  for (const f of Object.values(REG_FIELDS)) {
    const id = f.id;
    if (!usesBachelor && (BACHELOR_FIELD_IDS as readonly string[]).includes(id)) continue;
    const rv = raw[id];
    let out: Json | null = null;

    switch (id) {
      case "gender": {
        const g = normalizeGender(rv);
        if (g === "invalid") invalidMsg(id, choiceHint);
        else out = g;
        break;
      }
      case "desired_visa_type": {
        const v = normalizeDesiredVisa(rv);
        if (v === "invalid") invalidMsg(id, tr(locale, "D-4 / D-2 / other 중 하나", "Chọn D-4 / D-2 / other"));
        else out = v;
        break;
      }
      case "final_education_level": {
        if (levelRaw === "invalid") invalidMsg(id, choiceHint);
        else out = levelRaw;
        break;
      }
      case "topik_level": {
        const t = normalizeTopik(rv);
        if (t === "invalid") invalidMsg(id, tr(locale, "1~6급", "Cấp 1–6"));
        else out = t;
        break;
      }
      case "desired_term":
        out = normalizeTerm(rv);
        break;
      default: {
        if (f.input === "date") {
          const d = normalizeDate(rv);
          if (d === "invalid") invalidMsg(id, dateHint);
          else out = d;
        } else if (f.input === "number") {
          const n = normalizeNumber(rv);
          if (n === "invalid") invalidMsg(id, numHint);
          else out = n;
        } else if (f.input === "yesno") {
          const s = str(rv);
          if (s) {
            const yn = normalizeYesNo(s);
            if (!yn) invalidMsg(id, tr(locale, "예/아니오(yes/no)", "Có/Không (yes/no)"));
            else out = yn;
          }
        } else {
          const s = restoreLeadingZero(id, rv);
          out = s ? s : null;
        }
      }
    }

    if (out === null || out === "") {
      if (f.required && !errors[id]) {
        errors[id] = tr(locale, `${f.ko}: 필수 항목입니다`, `${f.vi}: bắt buộc`);
      }
      continue;
    }
    if (id !== "name") values[id] = out;
  }

  const name = str(raw.name);

  // 현주소 3칸 → 기존 서류가 쓰는 한 줄 주소(home_country_address)에도 같이 저장
  const addr = [values.home_ward, values.home_district, values.home_province]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .join(", ");
  if (addr) values.home_country_address = addr;

  // 이름(베트남어) 도 데이터 항목에 — 시드와 같은 키
  if (name) values.full_name_vi = name;

  const s = (k: string): string | null => {
    const v = values[k];
    return typeof v === "string" && v ? v : null;
  };

  return {
    errors,
    student: {
      name,
      dob: s("birth_date"),
      phone: s("student_phone"),
      email: s("student_email"),
      passport_no: s("passport_no"),
      topik_level: s("topik_level"),
    },
    values,
  };
}

/** 엑셀 한 행(칸 정의 → 셀값) 을 normalizeRegistration 입력으로 푼다 */
export function rosterRowToRaw(
  cells: Array<{ column: RosterColumn; value: unknown }>
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  let levelCell: unknown = null;
  for (const { column, value } of cells) {
    if (column.key === "final_education_level") levelCell = value;
  }
  const lv = normalizeEducationLevel(levelCell);
  const fk = finalEducationKeys(lv === "invalid" ? null : lv);
  for (const { column, value } of cells) {
    if (column.special === "name") raw.name = value;
    else if (column.special === "final_school") raw[fk.school] = value;
    else if (column.special === "final_admission") raw[fk.admission] = value;
    else if (column.special === "final_graduation") raw[fk.graduation] = value;
    else if (column.key) raw[column.key] = value;
  }
  return raw;
}
