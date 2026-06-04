"use client";

import { deleteStudentAction } from "../actions";

export function DeleteStudentButton({
  studentId,
  studentName,
  applicationCount,
}: {
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
            ? `Xóa sinh viên "${studentName}"?\n\n⚠ ${applicationCount} đơn tuyển sinh sẽ bị xóa theo (cascade).\n\nHành động này không thể hoàn tác.`
            : `Xóa sinh viên "${studentName}"?\n\nHành động này không thể hoàn tác.`;
        if (!window.confirm(warning)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Xóa sinh viên
      </button>
    </form>
  );
}
