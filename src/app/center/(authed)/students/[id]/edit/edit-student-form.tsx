"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  updateStudentAction,
  type UpdateStudentState,
} from "./actions";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-sm font-medium text-slate-700";
const requiredMarkClass = "ml-0.5 text-red-500";
const errorTextClass = "text-xs text-red-600";
const helpTextClass = "text-xs text-slate-500";

export type EditableStudent = {
  id: string;
  name: string;
  dob: string | null;
  passport_no_encrypted: string | null;
  phone: string | null;
  email: string | null;
  topik_level: string | null;
  current_visa: string | null;
  location: string | null;
  notes: string | null;
};

export function EditStudentForm({ student }: { student: EditableStudent }) {
  const boundAction = updateStudentAction.bind(null, student.id);
  const [state, action, pending] = useActionState<UpdateStudentState, FormData>(
    boundAction,
    undefined
  );

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={labelClass}>
        <span className={labelTextClass}>
          Họ và tên
          <span className={requiredMarkClass}>*</span>
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={100}
          defaultValue={student.name}
          className={inputClass}
        />
        {fieldError("name") ? (
          <span className={errorTextClass}>{fieldError("name")}</span>
        ) : null}
      </label>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>Ngày sinh</span>
          <input
            type="date"
            name="dob"
            defaultValue={student.dob ?? ""}
            className={inputClass}
          />
          {fieldError("dob") ? (
            <span className={errorTextClass}>{fieldError("dob")}</span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Số hộ chiếu</span>
          <input
            type="text"
            name="passport_no"
            defaultValue={student.passport_no_encrypted ?? ""}
            className={inputClass}
          />
          {fieldError("passport_no") ? (
            <span className={errorTextClass}>{fieldError("passport_no")}</span>
          ) : (
            <span className={helpTextClass}>4–20 ký tự, chữ và số</span>
          )}
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Số điện thoại</span>
          <input
            type="tel"
            name="phone"
            defaultValue={student.phone ?? ""}
            className={inputClass}
          />
          {fieldError("phone") ? (
            <span className={errorTextClass}>{fieldError("phone")}</span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Email (sinh viên)</span>
          <input
            type="email"
            name="email"
            defaultValue={student.email ?? ""}
            className={inputClass}
          />
          {fieldError("email") ? (
            <span className={errorTextClass}>{fieldError("email")}</span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>TOPIK (cấp độ)</span>
          <select
            name="topik_level"
            className={inputClass}
            defaultValue={student.topik_level ?? ""}
          >
            <option value="">Chưa có</option>
            <option value="1">Cấp 1</option>
            <option value="2">Cấp 2</option>
            <option value="3">Cấp 3</option>
            <option value="4">Cấp 4</option>
            <option value="5">Cấp 5</option>
            <option value="6">Cấp 6</option>
          </select>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Visa hiện tại</span>
          <select
            name="current_visa"
            className={inputClass}
            defaultValue={student.current_visa ?? ""}
          >
            <option value="">Chưa có</option>
            <option value="D-4">D-4 (Khóa tiếng)</option>
            <option value="D-2">D-2 (Du học)</option>
            <option value="none">Không có</option>
            <option value="other">Khác</option>
          </select>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>Vị trí hiện tại</span>
          <select
            name="location"
            className={inputClass}
            defaultValue={student.location ?? ""}
          >
            <option value="">Chưa có</option>
            <option value="VN">Việt Nam</option>
            <option value="KR">Hàn Quốc</option>
            <option value="other">Khác</option>
          </select>
        </label>
      </div>

      <label className={labelClass}>
        <span className={labelTextClass}>Ghi chú</span>
        <textarea
          name="notes"
          maxLength={500}
          rows={3}
          defaultValue={student.notes ?? ""}
          className={inputClass}
        />
        {fieldError("notes") ? (
          <span className={errorTextClass}>{fieldError("notes")}</span>
        ) : (
          <span className={helpTextClass}>Tối đa 500 ký tự</span>
        )}
      </label>

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
          href={`/center/students/${student.id}`}
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Hủy
        </Link>
      </div>
    </form>
  );
}
