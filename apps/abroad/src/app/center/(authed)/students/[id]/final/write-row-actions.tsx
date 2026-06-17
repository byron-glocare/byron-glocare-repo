"use client";

import { useMemo, useState } from "react";

type InputField = { key: string; label: string; type: string };

/**
 * 작성서류 한 행의 액션 영역.
 *   - canFill(PDF+좌표 오버레이): 미리보기(인라인 iframe) + 채운 PDF 다운로드.
 *     · inputFields(생성 시 입력칸: 날짜 등)가 있으면 입력값을 받아 inputs 쿼리로 전달.
 *   - 그 외: 데이터시트(docx) 생성·다운로드 (미리보기 없음).
 */
export function WriteRowActions({
  canPreview,
  baseUrl,
  inputFields,
  downloadLabel,
  previewLabel,
  closeLabel,
  inputsTitle,
}: {
  canPreview: boolean;
  baseUrl: string;
  inputFields: InputField[];
  downloadLabel: string;
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

  const downloadUrl = baseUrl + inputsParam;
  const previewUrl = canPreview ? `${baseUrl}&preview=1${inputsParam}` : null;

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

      <div className="flex shrink-0 items-center gap-2">
        {previewUrl ? (
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
          key={previewUrl}
          src={previewUrl}
          className="h-[600px] w-full rounded-md border border-slate-200 bg-white"
          title="preview"
        />
      ) : null}
    </div>
  );
}
