/**
 * 모집요강 PDF(베트남어 전용) — 고정 문구 + 표시용 포맷터.
 *   PDF 에는 한국어가 나오지 않게 한다(베트남어 이름이 없는 고유명사·원문 입력값은 예외).
 *   순수 함수만 — 서버·클라이언트 어디서나 쓴다.
 */

export const GLOCARE_INTRO_VI =
  "Glocare là doanh nghiệp khởi nguồn từ Samsung Life, đào tạo và kết nối nhân lực toàn cầu cho các ngành công nghiệp Hàn Quốc. Glocare đồng hành cùng du học sinh từ khâu tuyển chọn đến định hướng nghề nghiệp.";

export const BROCHURE_SITE = "youstudyinkorea.com";
export const BROCHURE_FOOTER = `Glocare · ${BROCHURE_SITE}`;

export const L = {
  eyebrow: "Tuyển sinh du học sinh",
  brand: "GLOCARE",
  brandSub: "Du học Hàn Quốc",
  quota: (n: number) => `Chỉ tiêu: ${n} người`,
  quotaLabel: "Chỉ tiêu",
  quotaUnit: "người",
  courseLanguage: "Hệ tiếng Hàn (D-4)",
  courseRegular: "Hệ chính quy (D-2)",
  years: (n: number) => `Thời gian đào tạo: ${n} năm`,
  region: "Khu vực",

  secEligibility: "Điều kiện đăng ký",
  secTuition: "Học phí & học bổng",
  secSchedule: "Lịch tuyển sinh",
  secCareer: "Triển vọng sau tốt nghiệp",
  secStrengths: "Điểm mạnh của trường",
  secDocuments: "Hồ sơ cần nộp",

  education: "Trình độ học vấn",
  gpa: "Điểm trung bình (GPA)",
  age: "Độ tuổi",
  korean: "Năng lực tiếng Hàn",
  koreanAlt: "Hoặc thay thế bằng",
  english: "Năng lực tiếng Anh",
  financial: "Chứng minh tài chính",
  preferences: "Ưu tiên",
  program: "Chương trình học",

  tuitionTitle: "Học phí",
  scholarshipTitle: "Học bổng",
  dormitoryTitle: "Ký túc xá",
  tuitionPending: "Học phí sẽ được thông báo sau khi có kết quả trúng tuyển.",

  scheduleFootnote: "※ Chỉ tiêu và lịch trình có thể thay đổi theo quyết định của trường.",
  schoolForms: "Mẫu đơn của trường",
  optional: "(không bắt buộc)",
  or: "hoặc",
  empty: "Chưa có thông tin.",
} as const;

// ── 학기 ──────────────────────────────────────────────────────────────

const SEASON_VI: Record<string, string> = { Spring: "mùa xuân", Summer: "mùa hè", Fall: "mùa thu", Winter: "mùa đông" };
const SEASON_ORDER: Record<string, number> = { Year: 0, Spring: 1, Summer: 2, Fall: 3, Winter: 4 };

/** "2027-Spring" → "Học kỳ mùa xuân 2027" · "2027-Year" → "Năm học 2027 (cả năm)" */
export function termLabelVi(term: string | null | undefined): string {
  if (!term) return "";
  const m = /^(\d{4})-(\w+)$/.exec(term.trim());
  if (!m) return term;
  const [, y, s] = m;
  if (s === "Year") return `Năm học ${y} (cả năm)`;
  return SEASON_VI[s] ? `Học kỳ ${SEASON_VI[s]} ${y}` : term;
}

/** 학기 시간순 정렬 키 (큰 값 = 나중) */
export function termSortKey(term: string): number {
  const m = /^(\d{4})-(\w+)$/.exec(term.trim());
  if (!m) return 0;
  return Number(m[1]) * 10 + (SEASON_ORDER[m[2]] ?? 0);
}

// ── 숫자·날짜 ─────────────────────────────────────────────────────────

/** 3287000 → "3.287.000" */
export function fmtNumber(n: number): string {
  const [int, dec] = String(Math.abs(n)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${grouped}${dec ? `,${dec}` : ""}`;
}

export function fmtMoney(n: number | null | undefined, currency = "KRW"): string | null {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return `${fmtNumber(Number(n))} ${currency || "KRW"}`;
}

/** "2027-01-05" → "05/01/2027" · 날짜가 아니면 원문 */
export function fmtDate(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const ym = /^(\d{4})-(\d{2})$/.exec(s);
  if (ym) return `${ym[2]}/${ym[1]}`;
  return s;
}

export function fmtRange(a: string | null | undefined, b: string | null | undefined): string | null {
  const x = fmtDate(a);
  const y = fmtDate(b);
  if (x && y) return x === y ? x : `${x} – ${y}`;
  return x ?? y ?? null;
}

export const hasHangul = (s: string | null | undefined): boolean => /[가-힣]/.test(String(s ?? ""));

// ── 자격 ──────────────────────────────────────────────────────────────

export const EDUCATION_VI: Record<string, string> = {
  high_school: "Tốt nghiệp THPT (hoặc tương đương)",
  high_school_12yrs: "Hoàn thành chương trình giáo dục phổ thông 12 năm",
  health_related_bachelor: "Tốt nghiệp đại học khối ngành y tế – sức khỏe",
  bachelor: "Tốt nghiệp đại học (cử nhân)",
  master: "Tốt nghiệp thạc sĩ",
};

export const ALT_PATH_VI: Record<string, string> = {
  sejong_institute: "Hoàn thành khóa học tại Viện King Sejong",
  kiip: "Chương trình Hội nhập Xã hội (KIIP)",
  university_internal_test: "Kỳ thi tiếng Hàn do trường tổ chức",
  korean_education_center: "Khóa học tại Trung tâm Giáo dục Hàn Quốc",
  health_science_degree: "Có bằng cấp ngành y tế – sức khỏe",
  elder_care_career: "Có kinh nghiệm làm việc trong lĩnh vực chăm sóc người cao tuổi",
};

const HOLDER_VI: Record<string, string> = { self: "bản thân", parent: "bố/mẹ", guardian: "người giám hộ", financial_sponsor: "người bảo lãnh tài chính" };

export type AgeLike = {
  min_age?: number | null;
  max_age?: number | null;
  birth_date_from?: string | null;
  birth_date_to?: string | null;
  reference_date?: string | null;
};

/** 나이 요건 — 원문이 쓴 쪽만 문장으로 (age-requirement.ts 의 베트남어판) */
export function ageRequirementVi(age: AgeLike | null | undefined): string | null {
  if (!age) return null;
  const parts: string[] = [];
  const { min_age: min, max_age: max } = age;
  if (min != null && max != null) parts.push(`Từ ${min} đến ${max} tuổi`);
  else if (min != null) parts.push(`Từ ${min} tuổi trở lên`);
  else if (max != null) parts.push(`Không quá ${max} tuổi`);
  const from = fmtDate(age.birth_date_from);
  const to = fmtDate(age.birth_date_to);
  if (from && to) parts.push(`Sinh trong khoảng ${from} – ${to}`);
  else if (from) parts.push(`Sinh từ ${from} trở về sau`);
  else if (to) parts.push(`Sinh trước ${to}`);
  if (parts.length === 0) return null;
  const ref = fmtDate(age.reference_date);
  return ref ? `${parts.join(" · ")} (tính đến ${ref})` : parts.join(" · ");
}

export function gpaVi(min: number | null | undefined, scale: string | null | undefined): string | null {
  if (min == null) return null;
  const v = String(min).replace(".", ",");
  return scale ? `Tối thiểu ${v}/${scale}` : `Tối thiểu ${v}`;
}

export function topikVi(level: number | null | undefined): string | null {
  return level ? `TOPIK cấp ${level} trở lên` : null;
}

export function financialVi(f: { amount?: number | null; currency?: string; holder_relations?: string[]; freshness_days?: number | null } | null | undefined): string | null {
  if (!f || f.amount == null) return null;
  const parts = [`Số dư tối thiểu ${fmtMoney(f.amount, f.currency || "USD")}`];
  const holders = (f.holder_relations ?? []).map((h) => HOLDER_VI[h]).filter(Boolean);
  if (holders.length) parts.push(`đứng tên ${holders.join(" / ")}`);
  if (f.freshness_days) parts.push(`xác nhận trong vòng ${f.freshness_days} ngày`);
  return parts.join(", ");
}

// ── 학비·장학금 ───────────────────────────────────────────────────────

export const TUITION_UNIT_VI: Record<string, string> = {
  per_semester: "Học phí mỗi học kỳ",
  per_year: "Học phí mỗi năm",
  per_program: "Học phí toàn khóa",
};

export const FEE_VI = {
  application_fee: "Phí xét tuyển",
  admission_fee: "Phí nhập học",
  dorm_fee: "Phí ký túc xá",
  insurance_per_year: "Bảo hiểm (mỗi năm)",
  payment_method: "Hình thức thanh toán",
} as const;

export const APPLIES_TO_VI: Record<string, string> = {
  freshman: "Tân sinh viên",
  enrolled: "Sinh viên đang học",
  both: "Tân sinh viên và sinh viên đang học",
};

const pct = (v: number | string): string => {
  const n = typeof v === "number" ? v : Number(String(v).replace(/[%\s]/g, ""));
  if (!Number.isFinite(n)) return String(v);
  const p = n > 0 && n <= 1 ? Math.round(n * 1000) / 10 : n;
  return `${String(p).replace(".", ",")}%`;
};

export function scholarshipBenefitVi(s: {
  benefit_type?: string;
  benefit_value?: number | string | null;
  tiered_by_topik?: Record<string, number | string> | null;
}): string | null {
  const v = s.benefit_value;
  const has = v != null && String(v).trim() !== "";
  if (s.tiered_by_topik && Object.keys(s.tiered_by_topik).length) {
    const tiers = Object.entries(s.tiered_by_topik)
      .filter(([, x]) => x != null && String(x).trim() !== "" && Number(x) !== 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lv, x]) => `TOPIK ${lv}: ${s.benefit_type === "tuition_amount" && typeof x === "number" ? fmtMoney(x) : pct(x)}`);
    if (tiers.length) return `Giảm học phí theo cấp TOPIK — ${tiers.join(" · ")}`;
  }
  switch (s.benefit_type) {
    case "tuition_pct":
      return has ? `Giảm ${pct(v!)} học phí` : "Giảm học phí";
    case "tuition_amount":
      return has ? `Giảm ${typeof v === "number" ? fmtMoney(v) : v} học phí` : "Giảm học phí";
    case "admission_fee_waiver":
      return "Miễn phí nhập học";
    case "stipend":
      return has ? `Hỗ trợ sinh hoạt phí ${typeof v === "number" ? fmtMoney(v) : v}` : "Hỗ trợ sinh hoạt phí";
    case "dorm":
      return has ? `Hỗ trợ ký túc xá ${typeof v === "number" ? fmtMoney(v) : v}` : "Hỗ trợ ký túc xá";
    default:
      return has ? (typeof v === "number" ? fmtMoney(v) : String(v)) : null;
  }
}

// ── 일정 ──────────────────────────────────────────────────────────────

export const SCHEDULE_VI = {
  application: "Nhận hồ sơ",
  documents: "Hạn nộp hồ sơ bản cứng",
  interview: "Phỏng vấn",
  result: "Công bố kết quả",
  payment: "Nộp học phí",
  visa: "Cấp giấy báo nhập học (xin visa)",
  enrollment: "Đăng ký nhập học",
  enrollmentExtra: "Đăng ký nhập học bổ sung",
  orientation: "Định hướng tân sinh viên",
  semesterStart: "Khai giảng",
  semesterEnd: "Kết thúc học kỳ",
  submission: "Hình thức nộp hồ sơ",
  round: (n: string) => `Đợt ${n}`,
  singleRound: "Lịch tuyển sinh",
} as const;

/** 회차 이름 — "1차" → "Đợt 1". 그 밖의 한국어 이름은 번호로 대신한다. */
export function roundNameVi(name: string | null | undefined, index: number, total: number): string {
  const s = String(name ?? "").trim();
  const m = /^(\d+)\s*(차|회차)?$/.exec(s) ?? /^(\d+)\s*차/.exec(s);
  if (m) return SCHEDULE_VI.round(m[1]);
  if (s && !hasHangul(s)) return s;
  return total > 1 ? SCHEDULE_VI.round(String(index + 1)) : SCHEDULE_VI.singleRound;
}

// ── 서류 ──────────────────────────────────────────────────────────────

export const TARGET_VI: Record<string, string> = {
  father: "của bố",
  mother: "của mẹ",
  sponsor: "của người bảo lãnh tài chính",
  other: "khác",
};

export const DOC_COND_VI = {
  issuedWithin: (n: number) => `cấp trong vòng ${n} ngày`,
  validity: (n: number) => `còn hiệu lực ${n} ngày`,
  original: "nộp bản gốc",
} as const;

// ── 어학연수 프로그램 ─────────────────────────────────────────────────

export const LP_VI = {
  hoursPerWeek: (n: number) => `${n} giờ/tuần`,
  hoursPerSemester: (n: number) => `${n} giờ/học kỳ`,
  weeks: (n: number) => `${n} tuần/học kỳ`,
  schedule: "Thời gian học",
  visa: "Loại visa",
  visaExtension: "Gia hạn visa",
} as const;
