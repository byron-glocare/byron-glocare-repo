"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Eye, Trash2, RefreshCw } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";
import { uploadWithSignedToken } from "@/lib/storage/resilient-upload";

import {
  createSubmissionUploadAction,
  finalizeSubmissionUploadAction,
  getSubmissionFileSignedUrlAction,
  removeSubmissionFileAction,
} from "./actions";

/**
 * 제출서류 업로드. (업로드 직후 AI 읽기는 하지 않는다 — '정보 입력' 화면을 열 때
 *   아직 안 읽은 서류를 자동으로 읽어 빈 칸을 채우고 다른 값은 표시한다. 2026-09-22)
 */
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file: File) {
    setErr(null);
    setBusy(true);
    try {
      // 1) 서명 업로드 URL 발급 (작은 요청)
      const created = await createSubmissionUploadAction({
        studentId,
        docKey,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if (!created.ok) {
        setErr(created.error);
        return;
      }
      // 2) 브라우저 → Supabase 직접 업로드 (Vercel 4.5MB 한계 우회)
      //    1MB 조각으로 나눠 보내고 끊기면 이어서 (베트남→한국 경로에서 큰 요청이 끊기던 문제, 2026-09-22)
      setProgress(0);
      const up = await uploadWithSignedToken({
        bucket: created.bucket,
        path: created.path,
        token: created.token,
        file,
        onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
      });
      setProgress(null);
      if (!up.ok) {
        setErr(
          tr(
            locale,
            `업로드 실패: ${up.error}. 잠시 후 다시 시도해 주세요.`,
            `Tải lên thất bại: ${up.error}. Vui lòng thử lại sau.`
          )
        );
        return;
      }
      // 3) 완료 기록
      const fin = await finalizeSubmissionUploadAction({
        studentId,
        docKey,
        path: created.path,
        fileName: file.name,
        sizeBytes: file.size,
        mime: file.type || null,
      });
      if (!fin.ok) {
        setErr(fin.error);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(
        e instanceof Error
          ? `업로드 실패: ${e.message}`
          : "업로드 실패 — 네트워크/서버 상태를 확인하세요."
      );
    } finally {
      setBusy(false);
    }
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
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,application/pdf,image/*"
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
            disabled={pending || busy}
            className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
            title={tr(locale, "교체", "Thay")}
          >
            {pending || busy ? (
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
          disabled={pending || busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending || busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {tr(locale, "파일 올리기", "Tải lên")}
        </button>
      )}
      {progress !== null ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
          <Loader2 className="size-3 animate-spin" />
          {tr(locale, `올리는 중 ${progress}%`, `Đang tải lên ${progress}%`)}
        </span>
      ) : null}
      {err ? <span className="text-[11px] text-red-600">{err}</span> : null}
    </div>
  );
}
