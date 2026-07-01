"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  FileDown,
  Loader2,
  Send,
  Upload,
  RefreshCw,
  Undo2,
} from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  createFinalUploadAction,
  recordFinalUploadAction,
  submitFinalDocAction,
  unsubmitFinalDocAction,
  getFinalDocSignedUrlAction,
} from "./finalize-actions";

const BTN_BASE =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60";
const BTN_DARK = `${BTN_BASE} bg-slate-900 text-white hover:bg-slate-800`;
const BTN_OUTLINE = `${BTN_BASE} border border-slate-300 text-slate-700 hover:bg-slate-100`;
const BTN_PRIMARY = `${BTN_BASE} bg-emerald-600 text-white hover:bg-emerald-700`;

/**
 * 작성서류 한 행의 액션 — 우측 한 줄 배치:
 *   [빈 양식 다운로드] [초안 생성·다운로드] [완성본 업로드/교체] [최종 제출(완성본 있을 때만)]
 *   최종 제출 후: [최종 제출됨] [제출본 다운로드] [제출 취소]
 */
export function WriteRowActions({
  locale,
  studentId,
  formFileId,
  appId,
  docName,
  blankFormUrl,
  pdfBaseUrl,
  uploaded,
  submittedAt,
  noFillLabel,
}: {
  locale: Locale;
  studentId: string;
  formFileId: string;
  appId: string;
  docName: string;
  blankFormUrl: string | null;
  pdfBaseUrl: string | null;
  uploaded: { path: string; fileName: string; uploadedAt: string } | null;
  submittedAt: string | null;
  noFillLabel: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const created = await createFinalUploadAction({
        studentId,
        formFileId,
        appId,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if (!created.ok) {
        setErr(created.error);
        return;
      }
      const sb = createClient();
      const { error: upErr } = await sb.storage
        .from(created.bucket)
        .uploadToSignedUrl(created.path, created.token, file, {
          contentType: file.type || undefined,
        });
      if (upErr) {
        setErr(`업로드 실패: ${upErr.message}`);
        return;
      }
      const fin = await recordFinalUploadAction({
        studentId,
        formFileId,
        appId,
        docName,
        path: created.path,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if (!fin.ok) {
        setErr(fin.error);
        return;
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? `업로드 실패: ${e.message}` : "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setErr(null);
    setBusy(true);
    try {
      const r = await submitFinalDocAction({ studentId, formFileId, appId });
      if (!r.ok) setErr(r.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onUnsubmit() {
    if (
      !window.confirm(
        tr(
          locale,
          "제출을 취소할까요? 어드민에서 다시 숨겨집니다.",
          "Hủy nộp? Hồ sơ sẽ bị ẩn khỏi quản trị."
        )
      )
    )
      return;
    setErr(null);
    setBusy(true);
    try {
      const r = await unsubmitFinalDocAction({ studentId, formFileId, appId });
      if (!r.ok) setErr(r.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!uploaded) return;
    const r = await getFinalDocSignedUrlAction(uploaded.path);
    if (r.ok) window.open(r.url, "_blank", "noopener");
    else setErr(r.error);
  }

  const submitted = !!submittedAt;

  return (
    <div className="flex w-full flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.hwp,.hwpx,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* 빈 양식 다운로드 */}
        {blankFormUrl ? (
          <a
            href={blankFormUrl}
            target="_blank"
            rel="noopener"
            className={BTN_OUTLINE}
          >
            <FileDown className="size-3.5" />
            {tr(locale, "빈 양식", "Mẫu trống")}
          </a>
        ) : null}

        {/* 초안 생성·다운로드 */}
        {pdfBaseUrl ? (
          <a href={pdfBaseUrl} className={BTN_OUTLINE}>
            <Download className="size-3.5" />
            {tr(locale, "초안 다운로드", "Tải nháp")}
          </a>
        ) : (
          <span className="text-[11px] text-slate-400">{noFillLabel}</span>
        )}

        {submitted ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <Check className="size-3" />
              {tr(locale, "제출됨", "Đã nộp")} · {submittedAt!.slice(0, 10)}
            </span>
            <button type="button" onClick={onDownload} className={BTN_DARK}>
              <Download className="size-3.5" />
              {tr(locale, "완성본 다운로드", "Tải bản hoàn chỉnh")}
            </button>
            <button
              type="button"
              onClick={onUnsubmit}
              disabled={busy}
              className={BTN_OUTLINE}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Undo2 className="size-3.5" />
              )}
              {tr(locale, "제출 취소", "Hủy nộp")}
            </button>
          </>
        ) : (
          <>
            {/* 완성본 업로드 / 교체 */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={uploaded ? BTN_OUTLINE : BTN_DARK}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : uploaded ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploaded
                ? tr(locale, "완성본 교체", "Thay bản hoàn chỉnh")
                : tr(locale, "완성본 업로드", "Tải bản hoàn chỉnh")}
            </button>

            {/* 완성본 다운로드 + 최종 제출 (완성본 있을 때만) */}
            {uploaded ? (
              <>
                <button type="button" onClick={onDownload} className={BTN_OUTLINE}>
                  <Download className="size-3.5" />
                  {tr(locale, "완성본 다운로드", "Tải bản hoàn chỉnh")}
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={busy}
                  className={BTN_PRIMARY}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  {tr(locale, "제출", "Nộp")}
                </button>
              </>
            ) : null}
          </>
        )}
      </div>

      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}
    </div>
  );
}
