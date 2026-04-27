"use client";

import { useTransition } from "react";

import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitch({ current }: { current: Locale }) {
  const [pending, startTransition] = useTransition();

  function pick(next: Locale) {
    if (next === current || pending) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  return (
    <div className="inline-flex items-center rounded-md border border-border/60 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => pick("vi")}
        disabled={pending}
        className={
          current === "vi"
            ? "px-2 py-1 bg-primary text-primary-foreground font-medium"
            : "px-2 py-1 hover:bg-accent/50"
        }
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => pick("ko")}
        disabled={pending}
        className={
          current === "ko"
            ? "px-2 py-1 bg-primary text-primary-foreground font-medium"
            : "px-2 py-1 hover:bg-accent/50"
        }
      >
        KO
      </button>
    </div>
  );
}
