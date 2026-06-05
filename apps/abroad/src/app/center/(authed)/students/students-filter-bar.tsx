"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { tr, type Locale } from "@/lib/i18n";

const TOPIK_OPTS = ["1", "2", "3", "4", "5", "6"] as const;
const VISA_OPTS = ["D-4", "D-2", "none", "other"] as const;
const LOC_OPTS = ["VN", "KR", "other"] as const;

function visaLabel(locale: Locale, visa: string): string {
  switch (visa) {
    case "D-4":
      return "D-4";
    case "D-2":
      return "D-2";
    case "none":
      return tr(locale, "없음", "Không có");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return visa;
  }
}

function locLabel(locale: Locale, loc: string): string {
  switch (loc) {
    case "VN":
      return tr(locale, "베트남", "Việt Nam");
    case "KR":
      return tr(locale, "한국", "Hàn Quốc");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return loc;
  }
}

export function StudentsFilterBar({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const topik = searchParams.get("topik") ?? "";
  const visa = searchParams.get("visa") ?? "";
  const location = searchParams.get("location") ?? "";

  const updateParam = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${p.toString()}`);
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("q", q.trim());
  };

  const hasFilter = !!(q || topik || visa || location);

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <input
          type="search"
          placeholder={tr(
            locale,
            "이름 · 이메일 · 여권번호 검색...",
            "Tìm theo tên · email · hộ chiếu..."
          )}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />

        <select
          value={topik}
          onChange={(e) => updateParam("topik", e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">{tr(locale, "TOPIK · 전체", "TOPIK · tất cả")}</option>
          {TOPIK_OPTS.map((t) => (
            <option key={t} value={t}>
              {tr(locale, `${t}급`, `Cấp ${t}`)}
            </option>
          ))}
          <option value="__none__">{tr(locale, "없음", "Chưa có")}</option>
        </select>

        <select
          value={visa}
          onChange={(e) => updateParam("visa", e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">{tr(locale, "Visa · 전체", "Visa · tất cả")}</option>
          {VISA_OPTS.map((v) => (
            <option key={v} value={v}>
              {visaLabel(locale, v)}
            </option>
          ))}
        </select>

        <select
          value={location}
          onChange={(e) => updateParam("location", e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">{tr(locale, "위치 · 전체", "Vị trí · tất cả")}</option>
          {LOC_OPTS.map((l) => (
            <option key={l} value={l}>
              {locLabel(locale, l)}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "..." : tr(locale, "검색", "Tìm")}
        </button>

        {hasFilter ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname));
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "필터 지우기", "Xóa bộ lọc")}
          </button>
        ) : null}
      </form>
    </div>
  );
}
