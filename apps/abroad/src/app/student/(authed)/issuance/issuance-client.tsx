"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { tr, type Locale } from "@/lib/i18n";

import { createIssuanceOrderAction } from "./actions";
import { issuanceNotarizationLabel } from "./status";

export type PricingRow = {
  id: string;
  labelKo: string;
  notarization: string;
  unitPrice: number;
};

export type UniOption = { id: number; name: string };

export function IssuanceClient({
  locale,
  rows,
  universities,
  neededNames,
}: {
  locale: Locale;
  rows: PricingRow[];
  universities: UniOption[];
  neededNames: string[];
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [uniId, setUniId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const setQ = (id: string, n: number) =>
    setQty((cur) => ({ ...cur, [id]: Math.max(0, Math.min(20, n)) }));

  const selected = rows.filter((r) => (qty[r.id] ?? 0) > 0);
  const subtotal = useMemo(
    () => selected.reduce((s, r) => s + r.unitPrice * (qty[r.id] ?? 0), 0),
    [selected, qty]
  );

  const won = (n: number) =>
    `${n.toLocaleString()}${tr(locale, "원", " ₩")}`;

  const submit = () => {
    if (selected.length === 0) return;
    startTransition(async () => {
      const res = await createIssuanceOrderAction({
        universityId: uniId ? Number(uniId) : null,
        items: selected.map((r) => ({ pricingId: r.id, qty: qty[r.id] ?? 1 })),
      });
      if (res?.error) toast.error(res.error);
      // 성공 시 서버가 주문 상세로 redirect
    });
  };

  return (
    <div className="space-y-4">
      {neededNames.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs text-sky-800">
          <span className="font-semibold">
            {tr(locale, "지원에 필요한 발급 서류: ", "Giấy tờ cần cho hồ sơ: ")}
          </span>
          {neededNames.join(", ")}
        </div>
      )}

      {/* 대학(선택) */}
      {universities.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {tr(locale, "제출 대상 대학 (선택)", "Trường nộp (không bắt buộc)")}
          </label>
          <select
            value={uniId}
            onChange={(e) => setUniId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">
              {tr(locale, "공통 / 미지정", "Chung / chưa chọn")}
            </option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 서류 카탈로그 */}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {rows.map((r) => {
          const n = qty[r.id] ?? 0;
          return (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {r.labelKo}
                  </span>
                  {r.notarization !== "none" && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                      {issuanceNotarizationLabel(locale, r.notarization)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-700">
                  {won(r.unitPrice)}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQ(r.id, n - 1)}
                  disabled={n <= 0}
                  className="flex size-7 items-center justify-center rounded-md border border-slate-300 text-slate-600 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm tabular-nums">{n}</span>
                <button
                  type="button"
                  onClick={() => setQ(r.id, n + 1)}
                  className="flex size-7 items-center justify-center rounded-md border border-slate-300 text-slate-600"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 견적 + 신청 */}
      <div className="sticky bottom-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            {tr(locale, "예상 금액", "Tạm tính")}
          </span>
          <span className="text-lg font-bold text-slate-900">
            {won(subtotal)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {tr(
            locale,
            "현지 사정으로 대리 발급이 어려우면 서류별 추가금이 발생할 수 있습니다(담당자 안내).",
            "Nếu không thể xin cấp thay, có thể phát sinh phụ phí (nhân viên sẽ thông báo)."
          )}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={selected.length === 0 || pending}
          className="mt-3 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending
            ? tr(locale, "신청 중…", "Đang gửi…")
            : tr(
                locale,
                `${selected.length}건 신청하기`,
                `Đăng ký ${selected.length} mục`
              )}
        </button>
      </div>
    </div>
  );
}
