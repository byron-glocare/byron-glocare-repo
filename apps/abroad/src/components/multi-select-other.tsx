"use client";

import { useState } from "react";
import { tr, type Locale } from "@/lib/i18n";

type Opt = { value: string; label_ko: string; label_vi: string };

/**
 * 다중선택 + "기타 직접입력".
 *   value 배열 = 선택한 보기 value + (기타 자유텍스트 항목들).
 *   보기에 없는 문자열은 '기타'로 간주해 텍스트박스에 표시.
 *   AI 작문 기초자료 등 객관식+자유입력 혼합 항목에 사용.
 */
export function MultiSelectWithOther({
  locale,
  value,
  options,
  onCommit,
}: {
  locale: Locale;
  value: string[];
  options: Opt[];
  onCommit: (v: string[]) => void;
}) {
  const optionValues = new Set(options.map((o) => o.value));
  const known = value.filter((v) => optionValues.has(v));
  const others = value.filter((v) => !optionValues.has(v));

  const [otherText, setOtherText] = useState(others.join(", "));
  const [showOther, setShowOther] = useState(others.length > 0);

  const commit = (nextKnown: string[], nextOther: string) => {
    const o = nextOther.trim();
    onCommit([...nextKnown, ...(o ? [o] : [])]);
  };

  const toggle = (v: string) => {
    const next = known.includes(v)
      ? known.filter((x) => x !== v)
      : [...known, v];
    commit(next, otherText);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const checked = known.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                checked
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              {locale === "ko" ? o.label_ko : o.label_vi}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowOther((s) => !s)}
          className={`rounded-md border px-2.5 py-1 text-xs ${
            showOther || others.length > 0
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-dashed border-slate-300 hover:bg-slate-50"
          }`}
        >
          + {tr(locale, "기타 직접입력", "Khác (tự nhập)")}
        </button>
      </div>
      {showOther ? (
        <textarea
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onBlur={() => commit(known, otherText)}
          rows={2}
          placeholder={tr(
            locale,
            "보기에 없는 내용을 직접 적어주세요 (선택)",
            "Nhập nội dung khác không có trong danh sách (tùy chọn)"
          )}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      ) : null}
    </div>
  );
}
