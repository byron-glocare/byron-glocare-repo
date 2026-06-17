"use client";

import { useState, useTransition } from "react";
import { Link2, Copy, Check, Loader2 } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";
import { createFillLinkAction } from "./actions";

/**
 * 정보 입력 공개 링크 생성 — 유효기간 토큰 URL 발급 + 복사.
 *   학생/대리인이 로그인 없이 /fill/<token> 으로 정보입력을 채울 수 있다.
 */
export function FillLinkButton({
  locale,
  studentId,
}: {
  locale: Locale;
  studentId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createFillLinkAction({ studentId, days });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setUrl(`${window.location.origin}/fill/${res.token}`);
      setExpiresAt(res.expiresAt);
    });
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(tr(locale, "복사 실패 — 직접 복사하세요.", "Sao chép thất bại — hãy sao chép thủ công."));
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Link2 className="size-4" />
            {tr(locale, "외부 입력 링크", "Liên kết nhập ngoài")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {tr(
              locale,
              "로그인 없이 학생이 직접 정보를 입력할 수 있는 링크입니다. 입력하면 자동 저장됩니다.",
              "Liên kết để học sinh tự nhập thông tin mà không cần đăng nhập. Tự động lưu khi nhập."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            {[3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {tr(locale, `${d}일`, `${d} ngày`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {tr(locale, "링크 생성", "Tạo liên kết")}
          </button>
        </div>
      </div>

      {url ? (
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-2 text-xs hover:bg-slate-50"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? tr(locale, "복사됨", "Đã chép") : tr(locale, "복사", "Chép")}
            </button>
          </div>
          {expiresAt ? (
            <p className="text-[11px] text-slate-400">
              {tr(locale, "만료", "Hết hạn")}:{" "}
              {new Date(expiresAt).toLocaleString(locale === "ko" ? "ko-KR" : "vi-VN")}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
