"use client";

import { deleteApplicationAction } from "./actions";

export function DeleteApplicationButton({
  applicationId,
  studentId,
  departmentLabel,
}: {
  applicationId: string;
  studentId: string;
  departmentLabel: string | null;
}) {
  return (
    <form
      action={deleteApplicationAction.bind(null, applicationId, studentId)}
      onSubmit={(e) => {
        const label = departmentLabel ?? "đơn này";
        if (
          !window.confirm(
            `Xóa đơn tuyển sinh: ${label}?\nHành động này không thể hoàn tác.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        title="Xóa đơn"
      >
        Xóa
      </button>
    </form>
  );
}
