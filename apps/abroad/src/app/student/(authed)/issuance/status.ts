/** 발급대행 주문 상태 라벨/색 (학생 노출용). */

import { tr, type Locale } from "@/lib/i18n";

const NOTA: Record<string, { ko: string; vi: string }> = {
  none: { ko: "인증 없음", vi: "Không chứng thực" },
  translation_notarization: { ko: "번역 공증", vi: "Công chứng dịch" },
  consul: { ko: "영사확인", vi: "Xác nhận lãnh sự" },
  consul_for_vietnam: { ko: "베트남 영사확인", vi: "Xác nhận lãnh sự VN" },
  apostille: { ko: "아포스티유", vi: "Apostille" },
  apostille_or_consul: { ko: "아포스티유/영사확인", vi: "Apostille/lãnh sự" },
};

export function issuanceNotarizationLabel(locale: Locale, v: string): string {
  const l = NOTA[v];
  return l ? tr(locale, l.ko, l.vi) : v;
}

export function issuanceStatusLabel(locale: Locale, status: string): string {
  switch (status) {
    case "draft":
      return tr(locale, "작성 중", "Bản nháp");
    case "payment_pending":
      return tr(locale, "결제 대기", "Chờ thanh toán");
    case "paid":
      return tr(locale, "결제 완료", "Đã thanh toán");
    case "info_needed":
      return tr(locale, "정보 입력 필요", "Cần nhập thông tin");
    case "assigned":
      return tr(locale, "담당자 배정", "Đã phân công");
    case "contacted":
      return tr(locale, "담당자 연락", "Đã liên hệ");
    case "in_progress":
      return tr(locale, "발급 진행 중", "Đang xử lý");
    case "scheduled":
      return tr(locale, "발급 예정", "Đã lên lịch");
    case "issued":
      return tr(locale, "발급 완료", "Đã cấp");
    case "shipped":
      return tr(locale, "발송 완료", "Đã gửi");
    case "done":
      return tr(locale, "완료", "Hoàn tất");
    case "cancelled":
      return tr(locale, "취소됨", "Đã hủy");
    default:
      return status;
  }
}

export function issuanceStatusTone(status: string): string {
  switch (status) {
    case "done":
    case "shipped":
    case "issued":
      return "bg-success-bg text-success-ink";
    case "paid":
    case "in_progress":
    case "scheduled":
    case "assigned":
    case "contacted":
      return "bg-info-bg text-info";
    case "cancelled":
      return "bg-error-bg text-destructive";
    case "payment_pending":
    case "info_needed":
      return "bg-warning-bg text-warning";
    default:
      return "bg-subtle text-ink-light";
  }
}
