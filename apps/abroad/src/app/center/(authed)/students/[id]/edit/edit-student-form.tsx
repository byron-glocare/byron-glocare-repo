"use client";

import Link from "next/link";
import { useActionState } from "react";

import { tr, type Locale } from "@/lib/i18n";

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

export function EditStudentForm({
  locale,
  student,
}: {
  locale: Locale;
  student: EditableStudent;
}) {
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
          {tr(locale, "이름", "Họ và tên")}
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
          <span className={labelTextClass}>{tr(locale, "생년월일", "Ngày sinh")}</span>
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
          <span className={labelTextClass}>{tr(locale, "여권번호", "Số hộ chiếu")}</span>
          <input
            type="text"
            name="passport_no"
            defaultValue={student.passport_no_encrypted ?? ""}
            className={inputClass}
          />
          {fieldError("passport_no") ? (
            <span className={errorTextClass}>{fieldError("passport_no")}</span>
          ) : (
            <span className={helpTextClass}>
              {tr(locale, "4–20자, 영문·숫자", "4–20 ký tự, chữ và số")}
            </span>
          )}
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "전화번호", "Số điện thoại")}</span>
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
          <span className={labelTextClass}>
            {tr(locale, "이메일 (학생)", "Email (sinh viên)")}
          </span>
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
          <span className={labelTextClass}>{tr(locale, "TOPIK (급수)", "TOPIK (cấp độ)")}</span>
          <select
            name="topik_level"
            className={inputClass}
            defaultValue={student.topik_level ?? ""}
          >
            <option value="">{tr(locale, "없음", "Chưa có")}</option>
            <option value="1">{tr(locale, "1급", "Cấp 1")}</option>
            <option value="2">{tr(locale, "2급", "Cấp 2")}</option>
            <option value="3">{tr(locale, "3급", "Cấp 3")}</option>
            <option value="4">{tr(locale, "4급", "Cấp 4")}</option>
            <option value="5">{tr(locale, "5급", "Cấp 5")}</option>
            <option value="6">{tr(locale, "6급", "Cấp 6")}</option>
          </select>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "현재 비자", "Visa hiện tại")}</span>
          <select
            name="current_visa"
            className={inputClass}
            defaultValue={student.current_visa ?? ""}
          >
            <option value="">{tr(locale, "없음", "Chưa có")}</option>
            <option value="D-4">{tr(locale, "D-4 (어학연수)", "D-4 (Khóa tiếng)")}</option>
            <option value="D-2">{tr(locale, "D-2 (정규유학)", "D-2 (Du học)")}</option>
            <option value="none">{tr(locale, "비자 없음", "Không có")}</option>
            <option value="other">{tr(locale, "기타", "Khác")}</option>
          </select>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "현재 위치", "Vị trí hiện tại")}</span>
          <select
            name="location"
            className={inputClass}
            defaultValue={student.location ?? ""}
          >
            <option value="">{tr(locale, "없음", "Chưa có")}</option>
            <option value="VN">{tr(locale, "베트남", "Việt Nam")}</option>
            <option value="KR">{tr(locale, "한국", "Hàn Quốc")}</option>
            <option value="other">{tr(locale, "기타", "Khác")}</option>
          </select>
        </label>
      </div>

      <label className={labelClass}>
        <span className={labelTextClass}>{tr(locale, "메모", "Ghi chú")}</span>
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
          <span className={helpTextClass}>{tr(locale, "최대 500자", "Tối đa 500 ký tự")}</span>
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
          {pending
            ? tr(locale, "저장 중...", "Đang lưu...")
            : tr(locale, "변경사항 저장", "Lưu thay đổi")}
        </button>
        <Link
          href={`/center/students/${student.id}`}
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {tr(locale, "취소", "Hủy")}
        </Link>
      </div>
    </form>
  );
}
