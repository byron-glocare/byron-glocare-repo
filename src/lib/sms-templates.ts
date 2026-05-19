/**
 * SMS 메시지 템플릿.
 * 개발지시서 §6.7 (알림발송) 참고.
 *
 * 엑셀 `5.메시지` 시트의 함수를 기반으로 한 한국어 템플릿.
 * 실제 문구는 운영 중에 §8 설정 페이지에서 편집 가능하게 확장 예정.
 */

import { asciiUpper } from "./name-utils";

// =============================================================================
// 공통
// =============================================================================

function safeDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  return String(v);
}

// =============================================================================
// 1) 신규 교육생 알림 — 교육원 원장에게 발송
// =============================================================================

export type NewStudentTemplateStudent = {
  name_kr: string | null;
  name_vi: string | null;
  phone: string | null;
  visa_type: string | null;
  birth_year: number | null;
  topik_level: string | null;
  /** 예약금 = reservation_payments.amount (없으면 0 으로 표시) */
  reservationAmount: number | null;
  /** 해당 학생이 등록된 강의 — 학생마다 다를 수 있음 (대표값을 fallback 으로 사용) */
  classStartDate: string | null;
  classType: "weekday" | "night" | null;
  /** 특이사항 — 학생별 */
  extraNote?: string;
};

export type NewStudentTemplateInput = {
  centerName: string;
  /** 제목 라벨용 월 (없으면 학생 첫 번째 classStartDate 사용) — 예: 4 → "[4월 신규 교육생 안내]" */
  monthLabel?: number | null;
  students: NewStudentTemplateStudent[];
};

const NEW_STUDENT_FOOTER_NOTICE =
  "※ 예약금은 교육생의 시험비 액수와 같습니다. 교육생이 시험에 응시하지 못하더라도 환불되지 않으니 참고 부탁드립니다.";
const NEW_STUDENT_CLOSING =
  "진행에 궁금하신 점이나 어려운 점이 있으시면 언제든 연락주세요!";

export function buildNewStudentMessage(
  input: NewStudentTemplateInput
): string {
  // 제목 월 — 명시값 우선, 없으면 첫 학생의 class 시작 월
  let month = input.monthLabel ?? null;
  if (month == null) {
    const firstDate = input.students.find((s) => s.classStartDate)
      ?.classStartDate;
    if (firstDate) {
      const m = /^\d{4}-(\d{2})-\d{2}$/.exec(firstDate);
      if (m) month = Number(m[1]);
    }
  }

  const title = month
    ? `[${month}월 신규 교육생 안내]`
    : `[신규 교육생 안내]`;

  const greeting = [
    `${input.centerName} 원장님께,`,
    ``,
    `안녕하세요. 글로케어입니다.`,
    `아래와 같이 신규 교육생을 안내드리오니 확인 부탁드리겠습니다.`,
  ].join("\n");

  const totalLine = `대상 교육생: ${input.students.length}명`;

  const blocks = input.students.map((s, i) =>
    renderNewStudentBlock(s, i + 1, input.students.length)
  );

  const lines = [
    title,
    ``,
    greeting,
    ``,
    totalLine,
    ``,
    blocks.join("\n\n"),
    ``,
    NEW_STUDENT_FOOTER_NOTICE,
    ``,
    NEW_STUDENT_CLOSING,
  ];

  return lines.join("\n");
}

function renderNewStudentBlock(
  s: NewStudentTemplateStudent,
  index: number,
  total: number
): string {
  const nameVi = s.name_vi ? asciiUpper(s.name_vi) : "";
  const nameKr = s.name_kr ?? "";
  const nameLine = [nameVi, nameKr].filter(Boolean).join(" / ") || "(이름 없음)";
  const heading = total > 1 ? `[${index}/${total}]` : null;

  const klass = formatClassLabel(s.classStartDate, s.classType);
  const age = s.birth_year ? `${currentAgeKr(s.birth_year)}세` : "—";
  const topik = s.topik_level ? formatTopik(s.topik_level) : "—";
  const visa = s.visa_type ?? "—";
  const phone = s.phone ?? "—";
  const reservation =
    s.reservationAmount != null && s.reservationAmount > 0
      ? `${s.reservationAmount.toLocaleString("ko-KR")}원`
      : "—";

  const lines = [
    heading,
    `- 이름: ${nameLine}`,
    `- 희망 개강일: ${klass}`,
    `- 연락처: ${phone}`,
    `- 나이: ${age}`,
    `- 토픽: ${topik}`,
    `- 비자: ${visa}`,
    `- 예약금(시험비): ${reservation}`,
    `- 특이사항: ${s.extraNote?.trim() ?? ""}`,
  ];

  return lines.filter((l) => l !== null).join("\n");
}

/** "2026-04-17" + "weekday" → "26년 4월 17일 주간반" */
function formatClassLabel(
  iso: string | null,
  type: "weekday" | "night" | null
): string {
  if (!iso) return type === "night" ? "야간반" : type === "weekday" ? "주간반" : "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const yy = m[1].slice(2);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const t = type === "night" ? "야간반" : "주간반";
  return `${yy}년 ${mo}월 ${da}일 ${t}`;
}

/** "TOPIK 2" / "2급" / "2" → "2급" — 숫자 추출 후 "N급" 으로 통일 */
function formatTopik(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  const m = /(\d+)/.exec(trimmed);
  if (m) return `${m[1]}급`;
  return trimmed;
}

/** 출생년도 → 만 나이 (KST 기준, 단순 연도 차) */
function currentAgeKr(birthYear: number): number {
  const now = new Date();
  return now.getFullYear() - birthYear;
}

// =============================================================================
// 2) 수수료 정산 알림 — 교육원 원장에게 발송
// =============================================================================

export type CommissionSettlementTemplateInput = {
  centerName: string;
  bankName: string | null;
  bankAccount: string | null;
  year: number;
  month: number;
  items: {
    customerName: string;
    totalAmount: number;
    deductionAmount: number;
    receivedAmount: number;
  }[];
  extraNote?: string;
};

export function buildCommissionSettlementMessage(
  input: CommissionSettlementTemplateInput
): string {
  const header = `[글로케어] ${input.centerName} 원장님 안녕하세요.`;

  const totals = input.items.reduce(
    (acc, i) => {
      acc.total += i.totalAmount;
      acc.deduction += i.deductionAmount;
      acc.received += i.receivedAmount;
      return acc;
    },
    { total: 0, deduction: 0, received: 0 }
  );

  const intro = `${input.year}년 ${input.month}월 교육생 소개비 정산 안내 드립니다. 아래 ${input.items.length}명 기준입니다.`;

  const lines = input.items.map((item, i) => {
    const parts = [
      `${i + 1}. ${item.customerName}`,
      `소개비 ${formatKRW(item.totalAmount)}`,
    ];
    if (item.deductionAmount > 0) {
      parts.push(`공제 ${formatKRW(item.deductionAmount)}`);
      parts.push(`수령 ${formatKRW(item.receivedAmount)}`);
    }
    return parts.join(" / ");
  });

  const summary = [
    "",
    "━━━━━━━━━━━━━━━━",
    `총 소개비: ${formatKRW(totals.total)}`,
    totals.deduction > 0 ? `총 공제액: ${formatKRW(totals.deduction)}` : null,
    `최종 입금 요청: ${formatKRW(totals.received)}`,
  ].filter(Boolean);

  const bank =
    input.bankName && input.bankAccount
      ? `\n입금 계좌: ${input.bankName} ${input.bankAccount}`
      : "";

  const body = [header, "", intro, "", ...lines, ...summary, bank].join("\n");

  if (input.extraNote?.trim()) {
    return `${body}\n\n${input.extraNote.trim()}`;
  }
  return body;
}

// =============================================================================
// 3) 정산 내역 알림 — 운영자가 카카오톡/이메일 등에 직접 복사해 보낼 본문
//    (NHN SMS 가 아니라 외부 채널로 발송할 정산서 안내문)
// =============================================================================

export const COMPANY_INFO = {
  companyName: "주식회사 글로케어",
  bankName: "신한은행",
  bankAccount: "100-038-096550",
};

export type CommissionNotificationTemplateInput = {
  /** 교육원 — 사업자번호 / 대표자 / 발행 이메일 포함 */
  center: {
    name: string;
    business_number: string | null;
    director_name: string | null;
    email: string | null;
    tuition_fee_2026: number | null;
  };
  /** 정산 대상 월 (YYYY-MM-01) */
  settlementMonth: string;
  /** 정산 대상 교육생 + 개강반 (YYYY-MM-DD or "12월 30일 개강반" 표시용) */
  items: {
    customerName: string;
    classStartDate: string | null;
    classTypeLabel: string | null;
  }[];
  /** 정산 합계 */
  totals: {
    /** 합계 수강료 (info 용 — 25% 적용 전) */
    tuitionSum: number;
    /** 합계 소개비 (수강료 × 25%) */
    totalAmount: number;
    /** 합계 공제 */
    deductionAmount: number;
    /** 입금액 (소개비 − 공제) */
    receivedAmount: number;
  };
  /** 공제 사유 라벨 (있으면 본문에 명시 — 예: "시험비") */
  deductionLabel?: string;
};

export function buildCommissionNotificationMessage(
  input: CommissionNotificationTemplateInput
): string {
  const ym = input.settlementMonth.slice(0, 7);
  const [year, month] = ym.split("-");
  const studentLines = input.items.map((s) => {
    const className = s.classStartDate
      ? `${shortKoreanDate(s.classStartDate)} 개강반${
          s.classTypeLabel ? ` (${s.classTypeLabel})` : ""
        }`
      : s.classTypeLabel
        ? `${s.classTypeLabel}`
        : "—";
    return ` - ${s.customerName} / ${className}`;
  });
  // 세금계산서 — 부가세 별도 계산 (공급가액 = total × 100 / 110)
  const supply = Math.round(input.totals.totalAmount / 1.1);
  const vat = input.totals.totalAmount - supply;
  const tuitionFee = input.center.tuition_fee_2026 ?? 0;
  const dedLabel = input.deductionLabel
    ? `공제(${input.deductionLabel})`
    : "공제";

  const lines = [
    `${input.center.name} 원장님께,`,
    `저희 글로케어와 함께해주셔서 감사합니다. 아래와 같이 소개 수수료 정산을 안내드리오니 확인 부탁드리겠습니다.`,
    ``,
    `1. 대상기간: ${year}년 ${Number(month)}월`,
    ``,
    `2. 대상 교육생: ${input.items.length}명`,
    ...studentLines,
    ``,
    `3. 정산금액`,
    `1) 입금액`,
    ` - 수수료 기준: 교육생 수강료의 25%`,
    ` - 수강료: ${formatKRW(tuitionFee)}`,
    ` - 교육생 수: ${input.items.length}명`,
    ` - 총 정산액: ${formatKRW(input.totals.totalAmount)}`,
    input.totals.deductionAmount > 0
      ? ` - ${dedLabel}: ${formatKRW(input.totals.deductionAmount)}`
      : null,
    ` - 입금액: ${formatKRW(input.totals.receivedAmount)}`,
    `2) 입금정보`,
    ` - ${COMPANY_INFO.bankName} ${COMPANY_INFO.bankAccount} ${COMPANY_INFO.companyName}`,
    ` - 입금액: ${formatKRW(input.totals.receivedAmount)}`,
    ``,
    `4. 전자세금계산서 발행`,
    ` - 업체명: ${input.center.name}`,
    ` - 대표자: ${safeDash(input.center.director_name)}`,
    ` - 사업자등록번호: ${safeDash(input.center.business_number)}`,
    ` - 발행 이메일: ${safeDash(input.center.email)}`,
    ` - 발행금액: ${formatKRW(input.totals.totalAmount)} (공급가액: ${formatKRW(supply)} / 부가세액: ${formatKRW(vat)})`,
    ` - 발행일: 입금일로부터 1주일 이내`,
    ``,
    `다시 한번 글로케어와 함께해주셔서 감사드리며, 앞으로도 잘 부탁드리겠습니다.`,
    `진행에 궁금하신 점이나 어려운 점이 있으시면 언제든 연락주세요!`,
  ];

  return lines.filter((l) => l !== null).join("\n");
}

/** "2026-03-15" → "3월 15일" */
function shortKoreanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[2])}월 ${Number(m[3])}일`;
}

// =============================================================================
// 유틸
// =============================================================================

function formatKRW(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

// safeDash 미사용이지만 향후 추가 템플릿에서 사용 대비 export
export { safeDash };
