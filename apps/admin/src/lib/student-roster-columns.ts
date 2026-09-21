/**
 * 지원자 명단 엑셀 컬럼 정의 — "Abroad Student List_Glocare.xlsx" 양식 (2026-09-21 운영자 제공).
 *
 *   이 파일은 두 앱에 **같은 내용으로** 있다. 한쪽을 고치면 다른 쪽도 고친다.
 *     · apps/abroad/src/lib/center/student-roster-columns.ts — 센터 학생 등록 화면 · 엑셀 일괄 등록(양식·읽기)
 *     · apps/admin/src/lib/student-roster-columns.ts          — 어드민 지원자 명단 엑셀 다운로드
 *
 *   값은 작성서류가 쓰는 데이터 항목(study_student_data_values, data_type_key)에 저장한다 → 두 번 입력하지 않는다.
 *   `key` 가 없는 칸은 계산값이거나(결석 합계·월수입 합계·부족한 서류) 다른 곳에서 온다(지망·센터명).
 *
 *   머리글은 2줄: 1줄 = 그룹(한국어/베트남어), 2줄 = 하위 칸(학년·부/모 등). 하위 칸이 없으면 2줄은 비우고 세로 병합.
 */

export type RosterColumn = {
  /** 1줄 머리글 (그룹) */
  group: string;
  /** 2줄 머리글 (하위 칸). 없으면 group 이 두 줄을 차지한다 */
  sub?: string;
  /** 저장할 데이터 항목 키. 없으면 계산·외부 값 */
  key?: string;
  /** 특수 칸 */
  special?:
    | "seq"            // 순번
    | "name"           // 학생 이름 (study_managed_students.name)
    | "center"         // 유학센터 이름 (내보내기 전용)
    | "choice1" | "choice2" | "choice3" // 1~3지망 (내보내기 전용)
    | "final_school"   // 최종 졸업학교 — 최종학력에 따라 고교/대학
    | "final_admission" // 입학일자 — 최종학력에 따라
    | "final_graduation" // 졸업일자 — 최종학력에 따라
    | "absence_total"  // 결석 합계 (계산)
    | "income_total"   // 월수입 합계 (계산)
    | "missing_docs";  // 부족한 서류 (내보내기 전용, 계산)
  /** 등록 시 필수 */
  required?: boolean;
  /** 입력 방식 힌트 */
  input?: "text" | "date" | "number" | "select" | "yesno";
  /** 엑셀 열 너비 */
  width?: number;
  /** 등록 화면·양식에서 제외(내보내기 전용) */
  exportOnly?: boolean;
};

const G = {
  term: "지원 학기 / Kỳ đăng ký",
  choice: "지원 대학·학과 / Trường - ngành đăng ký",
  phone: "전화번호 / SĐT",
  address: "현주소 / Địa chỉ hiện tại",
  cccd: "신분증 번호 / Số CCCD",
  job: "부모 직업 / Nghề nghiệp bố mẹ",
  income: "월수입 / Thu nhập hàng tháng",
  hsGrade: "고교 성적 / Điểm cấp 3",
  absence: "결석일수 / Số buổi nghỉ",
  topik: "토픽 / TOPIK",
};

export const ROSTER_COLUMNS: RosterColumn[] = [
  { group: "순번 / STT", special: "seq", width: 6 },
  { group: G.term, key: "desired_term", required: true, input: "text", width: 14 },
  { group: G.choice, sub: "1지망 / NV1", special: "choice1", exportOnly: true, width: 26 },
  { group: G.choice, sub: "2지망 / NV2", special: "choice2", exportOnly: true, width: 26 },
  { group: G.choice, sub: "3지망 / NV3", special: "choice3", exportOnly: true, width: 26 },
  { group: "유학 업체명 / Tên công ty du học", special: "center", exportOnly: true, width: 18 },
  { group: "비자 종류 / Loại visa muốn đăng ký", key: "desired_visa_type", required: true, input: "select", width: 12 },
  { group: "이름 / Họ tên", special: "name", required: true, input: "text", width: 20 },
  { group: "영문이름 / Tên tiếng Anh", key: "full_name_en", required: true, input: "text", width: 22 },
  { group: "한국비자 신청 이력 / Đã xin hoặc trượt visa Hàn chưa", key: "korea_visa_history", input: "text", width: 18 },
  { group: "성별 / Giới tính", key: "gender", required: true, input: "select", width: 8 },
  { group: "생년월일 / Ngày sinh", key: "birth_date", required: true, input: "date", width: 12 },
  { group: "여권번호 / Số hộ chiếu", key: "passport_no", input: "text", width: 14 },
  { group: "여권발급일 / Ngày cấp hộ chiếu", key: "passport_issued", input: "date", width: 12 },
  { group: "여권만료일 / Ngày hết hạn hộ chiếu", key: "passport_expiry", input: "date", width: 12 },
  { group: "최종학력 / Học lực cao nhất", key: "final_education_level", input: "select", width: 14 },
  { group: "최종 졸업학교 / Trường tốt nghiệp cao nhất", special: "final_school", width: 22 },
  { group: "입학일자 / Ngày nhập học", special: "final_admission", width: 12 },
  { group: "졸업일자 / Ngày tốt nghiệp", special: "final_graduation", width: 12 },
  { group: G.hsGrade, sub: "1학년 / Lớp 10", key: "hs_grade_1", input: "number", width: 8 },
  { group: G.hsGrade, sub: "2학년 / Lớp 11", key: "hs_grade_2", input: "number", width: 8 },
  { group: G.hsGrade, sub: "3학년 / Lớp 12", key: "hs_grade_3", input: "number", width: 8 },
  { group: "고교 전체평균 / Điểm TB 3 năm", key: "highschool_gpa", input: "number", width: 10 },
  { group: G.absence, sub: "1학년 / Lớp 10", key: "hs_absence_1", input: "number", width: 8 },
  { group: G.absence, sub: "2학년 / Lớp 11", key: "hs_absence_2", input: "number", width: 8 },
  { group: G.absence, sub: "3학년 / Lớp 12", key: "hs_absence_3", input: "number", width: 8 },
  { group: G.absence, sub: "합계 / Tổng", special: "absence_total", width: 8 },
  { group: "최종학력 점수 / Điểm tốt nghiệp CĐ-ĐH", key: "final_education_score", input: "text", width: 12 },
  { group: G.phone, sub: "학생 / Học sinh", key: "student_phone", required: true, input: "text", width: 14 },
  { group: G.phone, sub: "부 / Bố", key: "father_contact", input: "text", width: 14 },
  { group: G.phone, sub: "모 / Mẹ", key: "mother_contact", input: "text", width: 14 },
  { group: "이메일 / Email", key: "student_email", input: "text", width: 22 },
  { group: "출신지역 / Quê quán", key: "residence_city_vn", input: "text", width: 14 },
  { group: G.address, sub: "성·시 / Tỉnh, TP", key: "home_province", input: "text", width: 14 },
  { group: G.address, sub: "구·현 / Quận, Huyện", key: "home_district", input: "text", width: 14 },
  { group: G.address, sub: "동·마을 / Phường, Xã", key: "home_ward", input: "text", width: 14 },
  { group: G.cccd, sub: "본인 / Học sinh", key: "national_id_no", input: "text", width: 15 },
  { group: G.cccd, sub: "부 / Bố", key: "father_national_id", input: "text", width: 15 },
  { group: G.cccd, sub: "모 / Mẹ", key: "mother_national_id", input: "text", width: 15 },
  { group: "은행잔고증명서 / Có sổ ngân hàng không", key: "has_bank_balance_cert", input: "yesno", width: 12 },
  { group: G.job, sub: "부 / Bố", key: "father_occupation", input: "text", width: 14 },
  { group: G.job, sub: "모 / Mẹ", key: "mother_occupation", input: "text", width: 14 },
  { group: G.income, sub: "부 / Bố", key: "father_monthly_income", input: "number", width: 12 },
  { group: G.income, sub: "모 / Mẹ", key: "mother_monthly_income", input: "number", width: 12 },
  { group: G.income, sub: "합계 / Tổng", special: "income_total", width: 12 },
  { group: "부족한 서류 / Hồ sơ còn thiếu", special: "missing_docs", exportOnly: true, width: 24 },
  { group: "한국에 가족이 있는가 / Có người thân ở Hàn không", key: "has_family_in_korea", input: "yesno", width: 12 },
  { group: G.topik, sub: "급 / Cấp", key: "topik_level", input: "select", width: 8 },
  { group: G.topik, sub: "유효기간 / Hạn đến", key: "language_cert_valid_until", input: "date", width: 12 },
];

/** 등록 화면·일괄 등록 양식에 쓰는 칸 (내보내기 전용 제외) */
export const ROSTER_INPUT_COLUMNS = ROSTER_COLUMNS.filter((c) => !c.exportOnly);

/** 이 칸들로 저장하는 데이터 항목 키 전부 */
export const ROSTER_DATA_KEYS = ROSTER_COLUMNS.map((c) => c.key).filter((k): k is string => !!k);

/** 최종학력별로 "최종 졸업학교 / 입학일자 / 졸업일자" 가 가리키는 항목 */
export function finalEducationKeys(level: string | null | undefined): { school: string; admission: string; graduation: string } {
  return level === "college" || level === "university"
    ? { school: "bachelor_university", admission: "bachelor_admission_date", graduation: "bachelor_grad_date" }
    : { school: "highschool_name", admission: "high_school_admission_date", graduation: "highschool_grad_date" };
}

/** 예/아니오 칸 값 정규화 — 엑셀·화면 어느 쪽에서 와도 "yes" | "no" */
export function normalizeYesNo(v: unknown): "yes" | "no" | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["yes", "y", "o", "có", "co", "true", "1", "예", "있음", "유"].includes(s)) return "yes";
  if (["no", "n", "x", "không", "khong", "false", "0", "아니오", "없음", "무"].includes(s)) return "no";
  return null;
}

/** 숫자 합계 (빈 값은 건너뜀, 모두 비면 null) */
export function sumOrNull(values: unknown[]): number | null {
  let any = false;
  let total = 0;
  for (const v of values) {
    const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[, ]/g, ""));
    if (String(v ?? "").trim() === "" || Number.isNaN(n)) continue;
    any = true;
    total += n;
  }
  return any ? total : null;
}
