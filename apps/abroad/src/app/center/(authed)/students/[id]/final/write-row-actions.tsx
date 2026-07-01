"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  Eye,
  Loader2,
  Send,
  Upload,
  RefreshCw,
  Undo2,
  X,
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
 * 작성서류 한 행의 액션 — 새 플로우:
 *   1) 초안 생성·다운로드 (기본정보 채운 파일, 서버 저장 안 함)
 *   2) 수정본 업로드 (사람이 서명·보정한 최종 파일)
 *   3) 최종 제출하기 (submitted_at 세팅 → 어드민 노출) / 제출 취소
 */
export function WriteRowActions({
  locale,
  studentId,
  formFileId,
  appId,
  docName,
  engine,
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
  engine: "pdf" | "docx";
  pdfBaseUrl: string | null;
  uploaded: { path: string; fileName: string; uploadedAt: string } | null;
  submittedAt: string | null;
  noFillLabel: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pdfPreview = pdfBaseUrl ? `${pdfBaseUrl}&preview=1` : null;

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
      setErr(
        e instanceof Error ? `업로드 실패: ${e.message}` : "업로드 실패"
      );
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
          "최종 제출을 취소할까요? 어드민에서 다시 숨겨집니다.",
          "Hủy nộp cuối? Hồ sơ sẽ bị ẩn khỏi quản trị."
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
    <div className="flex w-full flex-col items-end gap-2">
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

      {/* 1) 초안 생성·다운로드 */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {pdfBaseUrl ? (
          engine === "pdf" ? (
            <>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={BTN_OUTLINE}
              >
                <Eye className="size-3.5" />
                {tr(locale, "초안 미리보기", "Xem nháp")}
              </button>
              <a href={pdfBaseUrl} className={BTN_OUTLINE}>
                <Download className="size-3.5" />
                {tr(locale, "초안 생성·다운로드", "Tạo & tải nháp")}
              </a>
            </>
          ) : (
            <a href={pdfBaseUrl} className={BTN_OUTLINE}>
              <Download className="size-3.5" />
              {tr(locale, "초안 생성·다운로드", "Tạo & tải nháp")}
            </a>
          )
        ) : (
          <span className="pt-1 text-[11px] text-slate-400">{noFillLabel}</span>
        )}
      </div>

      {/* 2·3) 수정본 업로드 → 최종 제출 */}
      {submitted ? (
        <div className="flex w-full flex-col items-end gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <Check className="size-3" />
            {tr(locale, "최종 제출됨", "Đã nộp")} · {submittedAt!.slice(0, 10)}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onDownload} className={BTN_DARK}>
              <Download className="size-3.5" />
              {tr(locale, "제출본 다운로드", "Tải bản nộp")}
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
          </div>
        </div>
      ) : uploaded ? (
        <div className="flex w-full flex-col items-end gap-1.5">
          <span className="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <Upload className="size-3" />
            {tr(locale, "수정본 업로드됨", "Đã tải bản sửa")}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onSubmit} disabled={busy} className={BTN_PRIMARY}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {tr(locale, "최종 제출하기", "Nộp cuối")}
            </button>
            <button type="button" onClick={onDownload} className={BTN_OUTLINE}>
              <Download className="size-3.5" />
              {tr(locale, "확인", "Xem")}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={BTN_OUTLINE}
            >
              <RefreshCw className="size-3.5" />
              {tr(locale, "교체", "Thay")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={BTN_DARK}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {tr(locale, "수정본 업로드", "Tải bản sửa")}
        </button>
      )}

      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}

      {/* 초안 미리보기 모달 (PDF) */}
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
                {tr(locale, "초안 미리보기", "Xem nháp")} · {docName}
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
