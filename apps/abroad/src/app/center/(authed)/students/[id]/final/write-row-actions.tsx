"use client";

import { useState } from "react";

/**
 * 작성서류 한 행의 액션 영역.
 *   - canFill(PDF+좌표 오버레이): 미리보기(인라인 iframe) + 채운 PDF 다운로드.
 *   - 그 외: 데이터시트(docx) 생성·다운로드 (미리보기 없음).
 */
export function WriteRowActions({
  canFill,
  downloadUrl,
  previewUrl,
  downloadLabel,
  previewLabel,
  closeLabel,
}: {
  canFill: boolean;
  downloadUrl: string;
  previewUrl: string | null;
  downloadLabel: string;
  previewLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-end gap-2">
      <div className="flex shrink-0 items-center gap-2">
        {canFill && previewUrl ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {open ? closeLabel : previewLabel}
          </button>
        ) : null}
        <a
          href={downloadUrl}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {downloadLabel}
        </a>
      </div>
      {open && previewUrl ? (
        <iframe
          src={previewUrl}
          className="h-[600px] w-full rounded-md border border-slate-200 bg-white"
          title="preview"
        />
      ) : null}
    </div>
  );
}
