/**
 * SMS 메시지 템플릿.
 * 개발지시서 §6.7 (알림발송) 참고.
 *
 * 엑셀 `5.메시지` 시트의 함수를 기반으로 한 한국어 템플릿.
 * 실제 문구는 운영 중에 §8 설정 페이지에서 편집 가능하게 확장 예정.
 */

import { formatDate } from "./format";

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

export type NewStudentTemplateInput = {
  centerName: string;
  classStartDate: string | null;
  classType: "weekday" | "night" | null;
  students: {
    name_kr: string | null;
    name_vi: string | null;
    phone: string | null;
    visa_type: string | null;
    birth_year: number | null;
  }[];
  /** 블라블라/특이사항 — 직접 입력 */
  extraNote?: string;
};

export function buildNewStudentMessage(
  input: NewStudentTemplateInput
): string {
  const header = `[글로케어] ${input.centerName} 원장님 안녕하세요.`;

  const classInfo = input.classStartDate
    ? `이번 ${formatDate(input.classStartDate)}${
        input.classType === "night" ? " (야간)" : " (주간)"
      } 개강 수업에`
    : "이번 개강 수업에";

  const intro = `${classInfo} 아래 ${input.students.length}명의 교육생이 등록되었습니다.`;

  const lines = input.students.map((s, i) => {
    const name = s.name_kr || s.name_vi || "(이름 없음)";
    const parts = [`${i + 1}. ${name}`];
    if (s.birth_year) parts.push(`${s.birth_year}년생`);
    if (s.visa_type) parts.push(s.visa_type);
    if (s.phone) parts.push(s.phone);
    return parts.join(" / ");
  });

  const body = [header, "", intro, "", ...lines].join("\n");

  if (input.extraNote?.trim()) {
    return `${body}\n\n${input.extraNote.trim()}`;
  }
  return body;
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
// 유틸
// =============================================================================

function formatKRW(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

// safeDash 미사용이지만 향후 추가 템플릿에서 사용 대비 export
export { safeDash };
