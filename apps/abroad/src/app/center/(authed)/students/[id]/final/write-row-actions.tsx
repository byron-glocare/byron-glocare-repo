"use client";

import { useMemo, useState } from "react";

type InputField = { key: string; label: string; type: string };

/**
 * 작성서류 한 행의 액션 영역 — 좌표 채움 PDF 전용.
 *   - 좌표(field_overlays)가 셋업된 양식이면 채움 PDF 다운로드 + 인라인 미리보기.
 *     · inputFields(생성 시 입력칸: 날짜 등)가 있으면 입력값을 inputs 쿼리로 전달.
 *   - 좌표 미설정 양식이면 안내만 (데이터 시트 폐지).
 */
export function WriteRowActions({
  pdfBaseUrl,
  inputFields,
  pdfLabel,
  previewLabel,
  closeLabel,
  inputsTitle,
  noFillLabel,
}: {
  pdfBaseUrl: string | null;
  inputFields: InputField[];
  pdfLabel: string;
  previewLabel: string;
  closeLabel: string;
  inputsTitle: string;
  noFillLabel: string;
}) {
  const [open, setOpen] = useState(false);
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

  const pdfDownload = pdfBaseUrl ? pdfBaseUrl + inputsParam : null;
  const pdfPreview = pdfBaseUrl ? `${pdfBaseUrl}&preview=1${inputsParam}` : null;

  // 좌표 미설정 양식 — 생성 불가 안내
  if (!pdfDownload) {
    return (
      <span className="shrink-0 pt-1 text-[11px] text-slate-400">
        {noFillLabel}
      </span>
    );
  }

  return (
    <div className="flex w-full flex-col items-end gap-2">
      {/* 생성 시 입력칸 (날짜 등) */}
      {inputFields.length > 0 ? (
        <div className="w-full rounded-md border border-slate-200 bg-slate-50/60 p-2">
          <p className="mb-1 text-[11px] font-medium text-slate-600">
            {inputsTitle}
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

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <a
          href={pdfDownload}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {pdfLabel}
        </a>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          {previewLabel}
        </button>
      </div>

      {/* 미리보기 — 큰 모달(화면 중앙)로 독립 표시 */}
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
                {previewLabel}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={pdfDownload}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {pdfLabel}
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {closeLabel}
                </button>
              </div>
            </div>
            <iframe
              key={pdfPreview}
              src={pdfPreview}
              className="min-h-0 flex-1 w-full bg-white"
              title="preview"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
