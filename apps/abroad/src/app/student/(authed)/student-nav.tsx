"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { tr, type Locale } from "@/lib/i18n";

/** 학생 포털 상단 글로벌 네비 — 어느 메뉴에서도 바로 이동. */
export function StudentNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  const items: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
    {
      href: "/student/universities",
      label: tr(locale, "대학 찾아 지원", "Tìm & đăng ký"),
      match: (p) => p.startsWith("/student/universities"),
    },
    {
      href: "/student/applications",
      label: tr(locale, "내 지원 · 서류작성", "Hồ sơ của tôi"),
      match: (p) =>
        p === "/student/applications" ||
        p.startsWith("/student/data") ||
        p.startsWith("/student/documents") ||
        p.startsWith("/student/final"),
    },
    {
      href: "/student/issuance",
      label: tr(locale, "발급 서류 대행", "Xin cấp giấy tờ"),
      match: (p) => p.startsWith("/student/issuance"),
    },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-5 py-2">
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
