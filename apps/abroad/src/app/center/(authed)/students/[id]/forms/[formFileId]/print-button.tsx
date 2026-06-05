"use client";

import { tr, type Locale } from "@/lib/i18n";

export function PrintButton({ locale }: { locale: Locale }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
    >
      {tr(locale, "🖨 인쇄 / PDF 저장", "🖨 In / Lưu PDF")}
    </button>
  );
}
