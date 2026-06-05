"use client";

import Link from "next/link";
import { useActionState } from "react";

import { tr, type Locale } from "@/lib/i18n";

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
  locale,
  application,
  studentId,
}: {
  locale: Locale;
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
          {tr(locale, "지원 학과", "Ngành học")} <span className="text-red-500">*</span>
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
            {tr(
              locale,
              '학과명을 자유롭게 수정할 수 있습니다 (예: "요양"에서 "바이오제약"으로 변경)',
              'Tự do chỉnh sửa tên ngành (ví dụ: chuyển từ "Yêu dưỡng" sang "Bio dược")'
            )}
          </span>
        )}
      </label>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "다음 할 일", "Việc tiếp theo")}</span>
          <input
            type="text"
            name="next_action"
            maxLength={200}
            defaultValue={application.next_action ?? ""}
            className={inputClass}
            placeholder={tr(locale, "예: 추천서 대기", "VD: Chờ thư giới thiệu")}
          />
          <span className={helpTextClass}>{tr(locale, "선택", "Tùy chọn")}</span>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "마감일", "Hạn chót")}</span>
          <input
            type="date"
            name="next_deadline"
            defaultValue={application.next_deadline ?? ""}
            className={inputClass}
          />
          <span className={helpTextClass}>{tr(locale, "선택", "Tùy chọn")}</span>
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
          {pending
            ? tr(locale, "저장 중...", "Đang lưu...")
            : tr(locale, "변경사항 저장", "Lưu thay đổi")}
        </button>
        <Link
          href={`/center/students/${studentId}`}
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {tr(locale, "취소", "Hủy")}
        </Link>
      </div>
    </form>
  );
}
