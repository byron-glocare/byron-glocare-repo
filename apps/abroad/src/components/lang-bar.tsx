"use client";

import { useTransition } from "react";

import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";

export function LangBar({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition();

  function pick(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  return (
    <div className="lang-bar">
      <button
        type="button"
        className={`lang-btn${locale === "vi" ? " on" : ""}`}
        onClick={() => pick("vi")}
        disabled={pending}
      >
        🇻🇳 Tiếng Việt
      </button>
      <button
        type="button"
        className={`lang-btn${locale === "ko" ? " on" : ""}`}
        onClick={() => pick("ko")}
        disabled={pending}
      >
        🇰🇷 한국어
      </button>
    </div>
  );
}
