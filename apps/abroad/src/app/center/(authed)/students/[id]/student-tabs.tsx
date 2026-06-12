"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { tr, type Locale } from "@/lib/i18n";

/**
 * 학생 처리 단계 = 고정 탭 바.
 *   개요 → 대학 선택 → 서류 등록 → 정보 입력 → 최종 서류
 *   각 탭은 라우트 세그먼트. 현재 경로로 활성 탭 판정.
 */
export function StudentTabs({
  studentId,
  locale,
}: {
  studentId: string;
  locale: Locale;
}) {
  const base = `/center/students/${studentId}`;
  const pathname = usePathname();

  const tabs: Array<{ seg: string; label: string }> = [
    { seg: "", label: tr(locale, "개요", "Tổng quan") },
    { seg: "select", label: tr(locale, "대학 선택", "Chọn trường") },
    { seg: "documents", label: tr(locale, "서류 등록", "Tải giấy tờ") },
    { seg: "data", label: tr(locale, "정보 입력", "Nhập thông tin") },
    { seg: "final", label: tr(locale, "최종 서류", "Hồ sơ cuối") },
  ];

  const activeSeg = (() => {
    if (pathname === base) return "";
    const rest = pathname.startsWith(base + "/")
      ? pathname.slice(base.length + 1)
      : "";
    const first = rest.split("/")[0] ?? "";
    // edit/applications 등 보조 경로는 가장 가까운 탭에 매핑
    if (first === "select" || first === "applications") return "select";
    if (first === "documents") return "documents";
    if (first === "data") return "data";
    if (first === "final" || first === "forms" || first === "essays")
      return "final";
    if (first === "edit") return ""; // 편집은 개요 소속
    return first;
  })();

  return (
    <nav className="flex flex-nowrap gap-1 overflow-x-auto">
      {tabs.map((t, i) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = activeSeg === t.seg;
        return (
          <Link
            key={t.seg || "overview"}
            href={href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-800"
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            <span className="whitespace-nowrap">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
