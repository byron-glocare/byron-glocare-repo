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
    <nav className="student-tabs" aria-label="Menu">
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`student-tab${active ? " on" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
