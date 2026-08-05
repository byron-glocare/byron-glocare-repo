"use client";

import { useTransition } from "react";

import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";

/**
 * 언어 전환 — 헤더 우측 텍스트 토글 (VI / KO).
 * 디자인 시스템: 국기 이모지를 쓰지 않고, 터치 대상은 44px 이상.
 */
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
        aria-label="Tiếng Việt"
      >
        VI
      </button>
      <button
        type="button"
        className={`lang-btn${locale === "ko" ? " on" : ""}`}
        onClick={() => pick("ko")}
        disabled={pending}
        aria-label="한국어"
      >
        KO
      </button>
    </div>
  );
}
