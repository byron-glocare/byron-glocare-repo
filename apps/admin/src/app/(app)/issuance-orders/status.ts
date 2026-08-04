/** 발급대행 주문 상태 라벨/색/순서 (어드민). */

export const ORDER_STATUSES = [
  "draft",
  "payment_pending",
  "paid",
  "info_needed",
  "assigned",
  "contacted",
  "in_progress",
  "scheduled",
  "issued",
  "shipped",
  "done",
  "cancelled",
] as const;

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  payment_pending: "결제 대기",
  paid: "결제 완료",
  info_needed: "정보 입력 필요",
  assigned: "담당자 배정",
  contacted: "담당자 연락",
  in_progress: "발급 진행 중",
  scheduled: "발급 예정",
  issued: "발급 완료",
  shipped: "발송 완료",
  done: "완료",
  cancelled: "취소됨",
};

export function orderStatusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "done":
    case "shipped":
    case "issued":
      return "secondary";
    case "cancelled":
      return "destructive";
    case "payment_pending":
    case "info_needed":
      return "outline";
    default:
      return "default";
  }
}
