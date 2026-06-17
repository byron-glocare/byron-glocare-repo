"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Eye, Trash2, RefreshCw } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";

import {
  uploadSubmissionFileAction,
  getSubmissionFileSignedUrlAction,
  removeSubmissionFileAction,
} from "./actions";

export function SubmissionUploader({
  locale,
  studentId,
  docKey,
  existing,
}: {
  locale: Locale;
  studentId: string;
  docKey: string;
  existing: { file_name: string; file_path: string } | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file: File) {
    setErr(null);
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("docKey", docKey);
    fd.set("file", file);
    const res = await uploadSubmissionFileAction(fd);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function onView() {
    if (!existing) return;
    const res = await getSubmissionFileSignedUrlAction(existing.file_path);
    if (res.ok) window.open(res.url, "_blank", "noopener");
    else setErr(res.error);
  }

  async function onRemove() {
    if (!existing) return;
    if (
      !window.confirm(
        tr(locale, "이 파일을 삭제할까요?", "Xóa tệp này?")
      )
    )
      return;
    const res = await removeSubmissionFileAction({
      studentId,
      docKey,
      path: existing.file_path,
    });
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      {existing ? (
        <div className="flex items-center gap-1.5">
          <span className="max-w-[10rem] truncate rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700 ring-1 ring-emerald-200">
            {existing.file_name}
          </span>
          <button
            type="button"
            onClick={onView}
            className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
            title={tr(locale, "보기", "Xem")}
          >
            <Eye className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
            title={tr(locale, "교체", "Thay")}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
            title={tr(locale, "삭제", "Xóa")}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {tr(locale, "파일 올리기", "Tải lên")}
        </button>
      )}
      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}
    </div>
  );
}
