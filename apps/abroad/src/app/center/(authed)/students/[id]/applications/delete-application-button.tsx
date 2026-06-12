"use client";

import { tr, type Locale } from "@/lib/i18n";

import { deleteApplicationAction } from "./actions";

export function DeleteApplicationButton({
  locale,
  applicationId,
  studentId,
  departmentLabel,
  giveUp,
}: {
  locale: Locale;
  applicationId: string;
  studentId: string;
  departmentLabel: string | null;
  /** true 면 '지원 포기' 라벨/문구로 표시 (개요 대학정보) */
  giveUp?: boolean;
}) {
  return (
    <form
      action={deleteApplicationAction.bind(null, applicationId, studentId)}
      onSubmit={(e) => {
        const label =
          departmentLabel ?? tr(locale, "이 지원", "đơn này");
        const msg = giveUp
          ? tr(
              locale,
              `지원 포기: ${label}?\n이 지원을 포기(삭제)하면 되돌릴 수 없습니다.`,
              `Từ bỏ nguyện vọng: ${label}?\nHành động này không thể hoàn tác.`
            )
          : tr(
              locale,
              `지원 내역 삭제: ${label}?\n이 작업은 되돌릴 수 없습니다.`,
              `Xóa đơn tuyển sinh: ${label}?\nHành động này không thể hoàn tác.`
            );
        if (!window.confirm(msg)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        title={giveUp ? tr(locale, "지원 포기", "Từ bỏ") : tr(locale, "지원 삭제", "Xóa đơn")}
      >
        {giveUp ? tr(locale, "지원 포기", "Từ bỏ") : tr(locale, "삭제", "Xóa")}
      </button>
    </form>
  );
}
