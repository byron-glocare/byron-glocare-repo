"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  updateApplicationAction,
  type UpdateApplicationState,
} from "./actions";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-sm font-medium text-slate-700";
const errorTextClass = "text-xs text-red-600";
const helpTextClass = "text-xs text-slate-500";

export type EditableApplication = {
  id: string;
  target_department_label: string | null;
  next_action: string | null;
  next_deadline: string | null;
};

export function EditApplicationForm({
  application,
  studentId,
}: {
  application: EditableApplication;
  studentId: string;
}) {
  const bound = updateApplicationAction.bind(
    null,
    application.id,
    studentId
  );
  const [state, action, pending] = useActionState<
    UpdateApplicationState,
    FormData
  >(bound, undefined);

  const fieldError = (n: string) => state?.fieldErrors?.[n]?.[0];

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={labelClass}>
        <span className={labelTextClass}>
          Ngành học <span className="text-red-500">*</span>
        </span>
        <input
          type="text"
          name="target_department_label"
          required
          maxLength={200}
          defaultValue={application.target_department_label ?? ""}
          className={inputClass}
        />
        {fieldError("target_department_label") ? (
          <span className={errorTextClass}>
            {fieldError("target_department_label")}
          </span>
        ) : (
          <span className={helpTextClass}>
            Tự do chỉnh sửa tên ngành (ví dụ: chuyển từ &quot;Yêu dưỡng&quot;
            sang &quot;Bio dược&quot;)
          </span>
        )}
      </label>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Việc tiếp theo</span>
          <input
            type="text"
            name="next_action"
            maxLength={200}
            defaultValue={application.next_action ?? ""}
            className={inputClass}
            placeholder="VD: Chờ thư giới thiệu"
          />
          <span className={helpTextClass}>Tùy chọn</span>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Hạn chót</span>
          <input
            type="date"
            name="next_deadline"
            defaultValue={application.next_deadline ?? ""}
            className={inputClass}
          />
          <span className={helpTextClass}>Tùy chọn</span>
        </label>
      </div>

      {state?.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
        <Link
          href={`/center/students/${studentId}`}
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Hủy
        </Link>
      </div>
    </form>
  );
}
