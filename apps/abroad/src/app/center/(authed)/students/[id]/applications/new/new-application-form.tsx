"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { tr, type Locale } from "@/lib/i18n";

import {
  createApplicationAction,
  type CreateApplicationState,
} from "./actions";

export type SpecOption = {
  id: string;
  universityNameKo: string | null;
  term: string;
  admissionCategory: string | null;
  programType: string;
  departments: Array<{
    name: string;
    faculty?: string | null;
    track?: string | null;
  }>;
};

function programTypeLabel(locale: Locale, programType: string): string {
  switch (programType) {
    case "language_program":
      return tr(locale, "어학연수 (D-4)", "Khóa tiếng (D-4)");
    case "associate_2yr":
      return tr(locale, "전문학사 2년", "Cao đẳng 2 năm");
    case "bachelor_3yr_extension":
      return tr(locale, "학사 편입 2+2", "Liên thông 2+2");
    case "bachelor_4yr":
      return tr(locale, "학사 4년", "Cử nhân 4 năm");
    default:
      return programType;
  }
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-sm font-medium text-slate-700";
const requiredMarkClass = "ml-0.5 text-red-500";
const errorTextClass = "text-xs text-red-600";
const helpTextClass = "text-xs text-slate-500";

function departmentLabel(d: SpecOption["departments"][number]): string {
  if (!d) return "";
  const parts: string[] = [];
  if (d.faculty) parts.push(d.faculty);
  parts.push(d.name);
  return d.track ? `${parts.join(" · ")} (${d.track})` : parts.join(" · ");
}

export function NewApplicationForm({
  locale,
  studentId,
  studentName,
  specs,
}: {
  locale: Locale;
  studentId: string;
  studentName: string;
  specs: SpecOption[];
}) {
  const boundAction = createApplicationAction.bind(null, studentId);
  const [state, action, pending] = useActionState<
    CreateApplicationState,
    FormData
  >(boundAction, undefined);

  const [specId, setSpecId] = useState<string>("");
  const selectedSpec = useMemo(
    () => specs.find((s) => s.id === specId),
    [specId, specs]
  );

  // spec 변경 시 학과 list 변경 → 첫 학과로 자동 선택 (1개면 고정)
  const [deptLabel, setDeptLabel] = useState<string>("");
  const onSpecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSpecId(id);
    const spec = specs.find((s) => s.id === id);
    if (spec && spec.departments.length > 0) {
      setDeptLabel(departmentLabel(spec.departments[0]));
    } else {
      setDeptLabel("");
    }
  };

  const fieldError = (name: string) => state?.fieldErrors?.[name]?.[0];

  if (specs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-600">
          {tr(
            locale,
            "승인된 모집요강이 없습니다.",
            "Chưa có hồ sơ tuyển sinh nào được duyệt."
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {tr(
            locale,
            "GLOCARE에서 데이터를 준비 중입니다. 잠시 후 다시 시도해 주세요.",
            "GLOCARE đang chuẩn bị dữ liệu. Vui lòng thử lại sau."
          )}
        </p>
        <Link
          href={`/center/students/${studentId}`}
          className="mt-4 inline-block text-sm text-slate-700 underline"
        >
          {tr(locale, "← 돌아가기", "← Quay lại")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="admission_spec_id" value={specId} />
      <input
        type="hidden"
        name="target_department_label"
        value={deptLabel}
      />

      <label className={labelClass}>
        <span className={labelTextClass}>
          {tr(locale, "모집요강", "Hồ sơ tuyển sinh")}
          <span className={requiredMarkClass}>*</span>
        </span>
        <select
          required
          className={inputClass}
          value={specId}
          onChange={onSpecChange}
        >
          <option value="">
            {tr(locale, "— 대학 · 과정 선택 —", "— Chọn trường · chương trình —")}
          </option>
          {specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.universityNameKo ?? "?"} · {programTypeLabel(locale, s.programType)} · {s.term}
            </option>
          ))}
        </select>
        {fieldError("admission_spec_id") ? (
          <span className={errorTextClass}>
            {fieldError("admission_spec_id")}
          </span>
        ) : null}
      </label>

      {selectedSpec ? (
        <label className={labelClass}>
          <span className={labelTextClass}>
            {tr(locale, "학과 · 전공", "Ngành · chuyên ngành")}
            <span className={requiredMarkClass}>*</span>
          </span>
          {selectedSpec.departments.length > 1 ? (
            <select
              required
              className={inputClass}
              value={deptLabel}
              onChange={(e) => setDeptLabel(e.target.value)}
            >
              <option value="">{tr(locale, "— 학과 선택 —", "— Chọn ngành —")}</option>
              {selectedSpec.departments.map((d) => {
                const label = departmentLabel(d);
                return (
                  <option key={label} value={label}>
                    {label}
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="text"
              className={inputClass + " bg-slate-50"}
              value={deptLabel}
              readOnly
            />
          )}
          {fieldError("target_department_label") ? (
            <span className={errorTextClass}>
              {fieldError("target_department_label")}
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "다음 할 일", "Việc tiếp theo")}</span>
          <input
            type="text"
            name="next_action"
            maxLength={200}
            className={inputClass}
            placeholder={tr(locale, "예: 추천서 받기", "VD: Nhận thư giới thiệu")}
          />
          <span className={helpTextClass}>{tr(locale, "선택", "Tùy chọn")}</span>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{tr(locale, "마감일", "Hạn chót")}</span>
          <input
            type="date"
            name="next_deadline"
            className={inputClass}
          />
          <span className={helpTextClass}>{tr(locale, "선택", "Tùy chọn")}</span>
        </label>
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {tr(locale, "초기 상태", "Trạng thái ban đầu")}:{" "}
        <strong>{tr(locale, "준비 중", "Đang chuẩn bị")}</strong>{" "}
        {tr(
          locale,
          "(서류 검토 시 업데이트됩니다)",
          "(sẽ cập nhật khi kiểm tra hồ sơ)"
        )}
      </div>

      {state?.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !specId || !deptLabel}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? tr(locale, "저장 중...", "Đang lưu...")
            : tr(
                locale,
                `${studentName} 지원 등록`,
                `Đăng ký nguyện vọng cho ${studentName}`
              )}
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
