"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";

import { importSubmissionFileAction } from "./actions";

/**
 * 다른 지원(대학)에 올려둔 같은 표준 서류의 파일을 이 서류로 복사 등록하는 버튼.
 *   세부요건(인증 등)이 달라 자동 공유되지 않는 경우에 노출된다.
 */
export function ImportFileButton({
  locale,
  studentId,
  fromDocKey,
  toDocKey,
  sourceLabel,
  fileName,
}: {
  locale: Locale;
  studentId: string;
  fromDocKey: string;
  toDocKey: string;
  sourceLabel: string;
  fileName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onImport() {
    if (
      !window.confirm(
        tr(
          locale,
          `${sourceLabel}에 올린 "${fileName}" 파일을 이 서류에도 등록할까요?\n(대학별 요건이 다를 수 있으니 파일이 그대로 유효한지 확인하세요)`,
          `Dùng tệp "${fileName}" đã tải cho ${sourceLabel} vào giấy tờ này?\n(Kiểm tra tệp có hợp lệ với yêu cầu của trường không)`
        )
      )
    )
      return;
    setErr(null);
    setBusy(true);
    try {
      const res = await importSubmissionFileAction({
        studentId,
        fromDocKey,
        toDocKey,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onImport}
        disabled={pending || busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-60"
        title={sourceLabel}
      >
        {pending || busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {tr(locale, "다른 대학 파일 가져오기", "Lấy tệp từ trường khác")}
      </button>
      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}
    </div>
  );
}
