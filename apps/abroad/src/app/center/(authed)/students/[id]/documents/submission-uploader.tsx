"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, Eye, Trash2, RefreshCw } from "lucide-react";

import { tr, type Locale } from "@/lib/i18n";
import { uploadWithSignedToken } from "@/lib/storage/resilient-upload";

import {
  createSubmissionUploadAction,
  finalizeSubmissionUploadAction,
  getSubmissionFileSignedUrlAction,
  removeSubmissionFileAction,
} from "./actions";
import {
  autoExtractUploadedFileAction,
  type ExtractProposal,
} from "../data/extract-actions";
import { ExtractConflictDialog } from "./extract-conflict-dialog";

export function SubmissionUploader({
  locale,
  studentId,
  docKey,
  existing,
  autoExtract = false,
}: {
  locale: Locale;
  studentId: string;
  docKey: string;
  existing: { file_name: string; file_path: string } | null;
  /**
   * 업로드 직후 그 파일을 AI 로 읽어 '정보 입력'을 채울지 (유학센터 화면만 true).
   *   빈 항목은 바로 저장, 현재 값과 다른 항목은 확인 창. 학생 포털은 기본값 false.
   */
  autoExtract?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [conflicts, setConflicts] = useState<{ fileName: string; items: ExtractProposal[] } | null>(null);

  /** 업로드 완료 후 자동 추출 — 실패해도 업로드는 이미 끝났으므로 경고만 */
  async function runAutoExtract(fileName: string) {
    setExtracting(true);
    const warn = (detail?: string) =>
      toast.warning(
        tr(
          locale,
          "업로드는 완료됐지만 서류 자동 읽기에 실패했습니다. '정보 입력'에서 직접 입력하거나 'AI로 채우기'를 다시 눌러 주세요.",
          "Đã tải lên, nhưng không tự đọc được giấy tờ. Hãy nhập tay ở 'Nhập thông tin' hoặc bấm lại 'Điền bằng AI'."
        ),
        detail ? { description: detail } : undefined
      );
    try {
      const res = await autoExtractUploadedFileAction({ studentId, docKey });
      if (!res.ok) {
        warn(res.error === "NO_FILES" || res.error === "FILES_TOO_LARGE" ? undefined : res.error);
        return;
      }
      if (res.applied.length > 0) {
        toast.success(
          tr(
            locale,
            `서류에서 ${res.applied.length}개 항목을 읽어 '정보 입력'에 채웠습니다.`,
            `Đã đọc ${res.applied.length} mục từ giấy tờ và điền vào 'Nhập thông tin'.`
          ),
          {
            description: res.applied
              .slice(0, 6)
              .map((a) => (locale === "ko" ? a.label_ko : a.label_vi))
              .join(", "),
          }
        );
      }
      if (res.conflicts.length > 0) {
        setConflicts({ fileName, items: res.conflicts });
      }
    } catch (e) {
      warn(e instanceof Error ? e.message : undefined);
    } finally {
      setExtracting(false);
    }
  }

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
      // 업로드 끝 → (센터만) 그 파일 자동 읽기. 기다리지 않는다 — 업로드 UI 는 바로 풀린다.
      if (autoExtract) void runAutoExtract(file.name);
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
      {extracting ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-violet-700">
          <Loader2 className="size-3 animate-spin" />
          {tr(locale, "AI가 서류를 읽는 중…", "AI đang đọc giấy tờ…")}
        </span>
      ) : null}
      {conflicts ? (
        <ExtractConflictDialog
          locale={locale}
          studentId={studentId}
          fileName={conflicts.fileName}
          conflicts={conflicts.items}
          onClose={() => setConflicts(null)}
        />
      ) : null}
    </div>
  );
}
