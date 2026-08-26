// 자동 문자 발송 — 서버/클라이언트 공용 상수

/** 시점의 기준으로 고를 수 있는 customers 의 날짜 필드 */
export const ANCHOR_FIELDS = [
  { value: "created_at", label: "가입일 (등록일)" },
  { value: "class_start_date", label: "교육 시작일" },
  { value: "class_end_date", label: "교육 종료일" },
  { value: "work_start_date", label: "근무 시작일 (취업일)" },
  { value: "work_end_date", label: "근무 종료일" },
  { value: "visa_change_application_date", label: "비자변경 신청일" },
  { value: "visa_change_date", label: "비자변경 완료일" },
  { value: "interview_date", label: "면접일" },
] as const;

export const ANCHOR_VALUES = ANCHOR_FIELDS.map((f) => f.value) as string[];

export function anchorLabel(value: string): string {
  return ANCHOR_FIELDS.find((f) => f.value === value)?.label ?? value;
}

/** "취업일 +10일 · 15:00" 같은 요약 문자열 */
export function describeTiming(rule: {
  anchor_field: string;
  offset_days: number;
  send_time: string | null;
}): string {
  const offset =
    rule.offset_days === 0
      ? "당일"
      : rule.offset_days > 0
        ? `+${rule.offset_days}일`
        : `${rule.offset_days}일`;
  const time = rule.send_time ? rule.send_time.slice(0, 5) : "즉시";
  return `${anchorLabel(rule.anchor_field)} ${offset} · ${time}`;
}
