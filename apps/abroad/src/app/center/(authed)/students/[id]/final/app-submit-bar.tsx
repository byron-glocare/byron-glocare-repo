"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";
import { submitAllForAppAction } from "./finalize-actions";

/**
 * 지원(대학)별 일괄 최종 제출 바.
 *   readyCount = 완성본이 올라왔지만 아직 최종 제출 안 된 작성서류 수.
 */
export function AppSubmitBar({
  locale,
  studentId,
  appId,
  readyCount,
}: {
  locale: Locale;
  studentId: string;
  appId: string;
  readyCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (readyCount <= 0) return null;

  async function onSubmitAll() {
    if (
      !window.confirm(
        tr(
          locale,
          `업로드된 완성본 ${readyCount}건을 모두 최종 제출할까요?`,
          `Nộp cuối tất cả ${readyCount} hồ sơ đã tải?`
        )
      )
    )
      return;
    setErr(null);
    setBusy(true);
    try {
      const r = await submitAllForAppAction({ studentId, appId });
      if (!r.ok) setErr(r.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex items-center justify-end gap-2">
      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}
      <button
        type="button"
        onClick={onSubmitAll}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Send className="size-3.5" />
        )}
        {tr(
          locale,
          `이 지원 서류 모두 제출 (${readyCount})`,
          `Nộp tất cả (${readyCount})`
        )}
      </button>
    </div>
  );
}
