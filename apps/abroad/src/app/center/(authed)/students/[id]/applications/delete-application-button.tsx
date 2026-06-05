"use client";

import { tr, type Locale } from "@/lib/i18n";

import { deleteApplicationAction } from "./actions";

export function DeleteApplicationButton({
  locale,
  applicationId,
  studentId,
  departmentLabel,
}: {
  locale: Locale;
  applicationId: string;
  studentId: string;
  departmentLabel: string | null;
}) {
  return (
    <form
      action={deleteApplicationAction.bind(null, applicationId, studentId)}
      onSubmit={(e) => {
        const label =
          departmentLabel ?? tr(locale, "이 지원", "đơn này");
        if (
          !window.confirm(
            tr(
              locale,
              `지원 내역 삭제: ${label}?\n이 작업은 되돌릴 수 없습니다.`,
              `Xóa đơn tuyển sinh: ${label}?\nHành động này không thể hoàn tác.`
            )
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        title={tr(locale, "지원 삭제", "Xóa đơn")}
      >
        {tr(locale, "삭제", "Xóa")}
      </button>
    </form>
  );
}
