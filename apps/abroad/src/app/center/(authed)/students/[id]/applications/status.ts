/**
 * 지원(application) 단계 값 — 일반 모듈(상수/타입/라벨).
 *
 * "use server" 파일(actions.ts)에서는 async 외 값 export 불가 →
 * 상태 목록/라벨을 여기로 분리. actions.ts·page 들에서 import.
 *
 * C4(2026-06): 단계 재정의 — 결제전/서류작성중/완료/제출완료/입학/불합격/중도취소.
 */

import { tr, type Locale } from "@/lib/i18n";

export const APP_STATUS_VALUES = [
  "payment_pending", // 결제 전
  "preparing",       // 서류 작성 중
  "docs_complete",   // 서류 작성 완료
  "submitted",       // 대학교 제출 완료
  "enrolled",        // 입학
  "rejected",        // 불합격
  "cancelled",       // 중도 취소
] as const;

export type ApplicationStatus = (typeof APP_STATUS_VALUES)[number];

export function appStatusLabel(locale: Locale, status: string): string {
  switch (status) {
    case "payment_pending":
      return tr(locale, "결제 전", "Chưa thanh toán");
    case "preparing":
      return tr(locale, "서류 작성 중", "Đang soạn hồ sơ");
    case "docs_complete":
      return tr(locale, "서류 작성 완료", "Hoàn tất hồ sơ");
    case "submitted":
      return tr(locale, "대학교 제출 완료", "Đã nộp trường");
    case "enrolled":
      return tr(locale, "입학", "Nhập học");
    case "rejected":
      return tr(locale, "불합격", "Không đỗ");
    case "cancelled":
      return tr(locale, "중도 취소", "Đã hủy");
    default:
      return status;
  }
}

/** 단계별 색상(배지용) */
export function appStatusTone(status: string): string {
  switch (status) {
    case "enrolled":
      return "bg-emerald-100 text-emerald-700";
    case "submitted":
    case "docs_complete":
      return "bg-sky-100 text-sky-700";
    case "rejected":
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    case "payment_pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
