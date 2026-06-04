"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { uploadStudentsAction, type ImportState } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    uploadStudentsAction,
    undefined
  );
  const [fileName, setFileName] = useState<string>("");

  return (
    <>
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            File Excel (.xlsx)
          </span>
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
          />
          {fileName ? (
            <span className="text-xs text-slate-500">Đã chọn: {fileName}</span>
          ) : null}
        </label>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Đang xử lý..." : "Tải lên và kiểm tra"}
          </button>
        </div>

        {state?.error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}
      </form>

      {state && state.rows ? <ImportResult state={state} /> : null}
    </>
  );
}

function ImportResult({ state }: { state: NonNullable<ImportState> }) {
  const ok = state.okCount ?? 0;
  const skipped = state.skippedCount ?? 0;
  const errors = state.errorCount ?? 0;
  const total = state.totalRows ?? 0;
  const rows = state.rows ?? [];

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-base font-semibold text-slate-900">
        Kết quả tải lên
      </h3>

      <div className="mb-4 grid grid-cols-4 gap-3 text-center text-sm">
        <Stat label="Tổng dòng" value={total} tone="neutral" />
        <Stat label="Thành công" value={ok} tone="ok" />
        <Stat label="Bỏ qua" value={skipped} tone="neutral" />
        <Stat label="Lỗi" value={errors} tone="error" />
      </div>

      {ok > 0 ? (
        <p className="mb-3 text-sm text-slate-700">
          ✅ Đã đăng ký <strong>{ok}</strong> sinh viên.{" "}
          <Link
            href="/center/students"
            className="text-blue-600 hover:underline"
          >
            Xem danh sách →
          </Link>
        </p>
      ) : null}

      <details open={errors > 0} className="text-sm">
        <summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
          Chi tiết từng dòng ({rows.length})
        </summary>
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-slate-700">Dòng</th>
                <th className="px-3 py-2 font-medium text-slate-700">Tên</th>
                <th className="px-3 py-2 font-medium text-slate-700">
                  Trạng thái
                </th>
                <th className="px-3 py-2 font-medium text-slate-700">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.rowNumber}
                  className={`border-t border-slate-200 ${
                    r.status === "error"
                      ? "bg-red-50"
                      : r.status === "skipped"
                        ? "bg-slate-50"
                        : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {r.rowNumber}
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {r.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.message ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "error" | "neutral";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "error"
        ? "text-red-700 bg-red-50"
        : "text-slate-700 bg-slate-50";
  return (
    <div className={`rounded-md px-3 py-2 ${color}`}>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="mt-0.5 text-xs">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "skipped" | "error" }) {
  const map = {
    ok: {
      label: "Thành công",
      cls: "bg-emerald-100 text-emerald-800",
    },
    skipped: {
      label: "Bỏ qua",
      cls: "bg-slate-200 text-slate-700",
    },
    error: {
      label: "Lỗi",
      cls: "bg-red-100 text-red-800",
    },
  } as const;
  const m = map[status];
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
