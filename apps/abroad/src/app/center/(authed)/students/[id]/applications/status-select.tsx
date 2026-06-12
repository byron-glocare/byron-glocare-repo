"use client";

import { useRef } from "react";

import { type Locale } from "@/lib/i18n";

import { updateApplicationStatusAction } from "./actions";
import { APP_STATUS_VALUES, appStatusLabel, appStatusTone } from "./status";

/** 단계 변경 즉시 적용(onChange) — 저장 버튼 없음 */
export function StatusSelect({
  locale,
  applicationId,
  studentId,
  current,
}: {
  locale: Locale;
  applicationId: string;
  studentId: string;
  current: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={updateApplicationStatusAction.bind(null, applicationId, studentId)}
    >
      <select
        name="status"
        defaultValue={current}
        onChange={() => formRef.current?.requestSubmit()}
        className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 ${appStatusTone(
          current
        )}`}
      >
        {APP_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {appStatusLabel(locale, s)}
          </option>
        ))}
      </select>
    </form>
  );
}
