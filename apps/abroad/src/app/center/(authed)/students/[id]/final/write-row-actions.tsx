"use client";

import { useMemo, useState } from "react";

type InputField = { key: string; label: string; type: string };

/**
 * 작성서류 한 행의 액션 영역.
 *   - 데이터 시트(.docx): 항상 제공. 양식의 필요 표준데이터 + 학생 값을 정리한 문서(위치 무관, 100% 정확).
 *   - 원본양식 PDF: 좌표(field_overlays)가 셋업된 양식만. 원본 위에 값을 채운 PDF + 인라인 미리보기.
 *     · inputFields(생성 시 입력칸: 날짜 등)가 있으면 입력값을 inputs 쿼리로 전달.
 */
export function WriteRowActions({
  docxUrl,
  pdfBaseUrl,
  inputFields,
  sheetLabel,
  pdfLabel,
  previewLabel,
  closeLabel,
  inputsTitle,
}: {
  docxUrl: string;
  pdfBaseUrl: string | null;
  inputFields: InputField[];
  sheetLabel: string;
  pdfLabel: string;
  previewLabel: string;
  closeLabel: string;
  inputsTitle: string;
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

  return (
    <div className="flex w-full flex-col items-end gap-2">
      {/* 원본 PDF 채움용 생성 시 입력칸 (날짜 등) */}
      {pdfBaseUrl && inputFields.length > 0 ? (
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
        {/* 데이터 시트 — 항상 (기본) */}
        <a
          href={docxUrl}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {sheetLabel}
        </a>
        {/* 원본양식 PDF — 좌표 셋업된 양식만 */}
        {pdfPreview ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {open ? closeLabel : previewLabel}
          </button>
        ) : null}
        {pdfDownload ? (
          <a
            href={pdfDownload}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {pdfLabel}
          </a>
        ) : null}
      </div>
      {open && pdfPreview ? (
        <iframe
          key={pdfPreview}
          src={pdfPreview}
          className="h-[600px] w-full rounded-md border border-slate-200 bg-white"
          title="preview"
        />
      ) : null}
    </div>
  );
}
