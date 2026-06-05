"use client";

import { tr, type Locale } from "@/lib/i18n";

import { deleteStudentAction } from "../actions";

export function DeleteStudentButton({
  locale,
  studentId,
  studentName,
  applicationCount,
}: {
  locale: Locale;
  studentId: string;
  studentName: string;
  applicationCount: number;
}) {
  return (
    <form
      action={deleteStudentAction.bind(null, studentId)}
      onSubmit={(e) => {
        const warning =
          applicationCount > 0
            ? tr(
                locale,
                `학생 "${studentName}"을(를) 삭제할까요?\n\n⚠ 지원 내역 ${applicationCount}건도 함께 삭제됩니다(연쇄 삭제).\n\n이 작업은 되돌릴 수 없습니다.`,
                `Xóa sinh viên "${studentName}"?\n\n⚠ ${applicationCount} đơn tuyển sinh sẽ bị xóa theo (cascade).\n\nHành động này không thể hoàn tác.`
              )
            : tr(
                locale,
                `학생 "${studentName}"을(를) 삭제할까요?\n\n이 작업은 되돌릴 수 없습니다.`,
                `Xóa sinh viên "${studentName}"?\n\nHành động này không thể hoàn tác.`
              );
        if (!window.confirm(warning)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        {tr(locale, "학생 삭제", "Xóa sinh viên")}
      </button>
    </form>
  );
}
