"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Eye, Loader2, RefreshCw, X } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";
import {
  finalizeFormDocAction,
  getFinalDocSignedUrlAction,
} from "./finalize-actions";

type InputField = { key: string; label: string; type: string };

const BTN_BASE =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60";
const BTN_DARK = `${BTN_BASE} bg-slate-900 text-white hover:bg-slate-800`;
const BTN_OUTLINE = `${BTN_BASE} border border-slate-300 text-slate-700 hover:bg-slate-100`;
const BTN_PRIMARY = `${BTN_BASE} bg-emerald-600 text-white hover:bg-emerald-700`;

/**
 * 작성서류 한 행의 액션 — 좌표 채움 PDF 전용.
 *   - 미확정: 미리보기 + 확정하기 (확정 시 PDF 생성·저장)
 *   - 확정됨: 확정본 다운로드 + 미리보기 + 재확정
 *   - 좌표 미설정 양식이면 안내만.
 */
export function WriteRowActions({
  locale,
  studentId,
  formFileId,
  appId,
  docName,
  engine,
  pdfBaseUrl,
  inputFields,
  finalized,
  noFillLabel,
}: {
  locale: Locale;
  studentId: string;
  formFileId: string;
  appId: string;
  docName: string;
  engine: "pdf" | "docx";
  pdfBaseUrl: string | null;
  inputFields: InputField[];
  finalized: { path: string; finalizedAt: string } | null;
  noFillLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      inputFields.map((f) => [f.key, f.type === "date" ? today : ""])
    )
  );

  const inputsParam = useMemo(() => {
    if (inputFields.length === 0) return "";
    return `&inputs=${encodeURIComponent(JSON.stringify(values))}`;
  }, [inputFields.length, values]);

  const pdfPreview = pdfBaseUrl ? `${pdfBaseUrl}&preview=1${inputsParam}` : null;

  if (!pdfBaseUrl) {
    return (
      <span className="shrink-0 pt-1 text-[11px] text-slate-400">
        {noFillLabel}
      </span>
    );
  }

  async function onFinalize() {
    setErr(null);
    setBusy(true);
    try {
      const r = await finalizeFormDocAction({
        studentId,
        formFileId,
        appId,
        docName,
        engine,
        inputs: inputFields.length > 0 ? values : undefined,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr(locale, "확정 실패", "Lỗi"));
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadFinal() {
    if (!finalized) return;
    setErr(null);
    const r = await getFinalDocSignedUrlAction(finalized.path);
    if (r.ok) window.open(r.url, "_blank", "noopener");
    else setErr(r.error);
  }

  return (
    <div className="flex w-full flex-col items-end gap-2">
      {/* 생성 시 입력칸 (날짜 등) */}
      {inputFields.length > 0 ? (
        <div className="w-full rounded-md border border-slate-200 bg-slate-50/60 p-2">
          <p className="mb-1 text-[11px] font-medium text-slate-600">
            {tr(locale, "생성 정보 입력", "Nhập thông tin tạo")}
          </p>
          <div className="flex flex-wrap gap-2">
            {inputFields.map((f) => (
              <label key={f.key} className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-500">{f.label}</span>
                <input
                  type={f.type === "date" ? "date" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  className="h-8 rounded-md border border-slate-300 px-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {finalized ? (
        <div className="flex w-full flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <Check className="size-3" />
            {tr(locale, "확정됨", "Đã xác nhận")} ·{" "}
            {finalized.finalizedAt.slice(0, 10)}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onDownloadFinal} className={BTN_DARK}>
              <Download className="size-3.5" />
              {tr(locale, "확정본 다운로드", "Tải bản xác nhận")}
            </button>
            {engine === "pdf" ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={BTN_OUTLINE}
              >
                <Eye className="size-3.5" />
                {tr(locale, "미리보기", "Xem trước")}
              </button>
            ) : pdfBaseUrl ? (
              <a href={pdfBaseUrl + inputsParam} className={BTN_OUTLINE}>
                <Download className="size-3.5" />
                {tr(locale, "생성·다운로드", "Tạo & tải")}
              </a>
            ) : null}
            <button
              type="button"
              onClick={onFinalize}
              disabled={busy}
              className={BTN_OUTLINE}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {tr(locale, "재확정", "Xác nhận lại")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {engine === "pdf" ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={BTN_OUTLINE}
            >
              <Eye className="size-3.5" />
              {tr(locale, "미리보기", "Xem trước")}
            </button>
          ) : pdfBaseUrl ? (
            <a href={pdfBaseUrl + inputsParam} className={BTN_OUTLINE}>
              <Download className="size-3.5" />
              {tr(locale, "생성·다운로드", "Tạo & tải")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={onFinalize}
            disabled={busy}
            className={BTN_PRIMARY}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            {tr(locale, "확정하기", "Xác nhận")}
          </button>
        </div>
      )}

      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}

      {/* 미리보기 — 큰 모달 */}
      {open && pdfPreview ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3 sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-800">
                {tr(locale, "미리보기", "Xem trước")} · {docName}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={BTN_OUTLINE}
              >
                <X className="size-3.5" />
                {tr(locale, "닫기", "Đóng")}
              </button>
            </div>
            <iframe
              key={pdfPreview}
              src={pdfPreview}
              className="min-h-0 w-full flex-1 bg-white"
              title="preview"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
