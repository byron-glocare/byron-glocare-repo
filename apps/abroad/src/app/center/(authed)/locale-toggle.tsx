"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Locale } from "@/lib/i18n";

/**
 * 유학센터 chrome 의 언어 토글 (VI / KO).
 *   - locale 쿠키를 설정하고 router.refresh() → 서버가 getLocale() 재읽기 후 재렌더.
 *   - 기본은 베트남어(vi). 쿠키는 1년 유지.
 */
export function LocaleToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(loc: Locale) {
    if (loc === current) return;
    document.cookie = `locale=${loc}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-slate-300 text-xs">
      {(["vi", "ko"] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          disabled={pending}
          aria-pressed={current === loc}
          className={
            current === loc
              ? "bg-slate-900 px-2.5 py-1 font-semibold text-white"
              : "bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          }
        >
          {loc === "vi" ? "VI" : "KO"}
        </button>
      ))}
    </div>
  );
}
