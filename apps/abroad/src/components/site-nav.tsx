"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LangBar } from "@/components/lang-bar";
import type { Locale } from "@/lib/i18n";

type NavStrings = {
  cases: string;
  universities: string;
  recruiting: string;
  centers: string;
  about: string;
  student: string;
  studentShort: string;
  apply: string;
};

/**
 * 공개 사이트 헤더 — 디자인 시스템 골격.
 *   68px sticky + blur / 컨테이너 1120 / pill 링크 13.5px
 *   우측: 언어 토글(VI·KO) + 보조 CTA(상담) + 주 CTA(유학 지원)
 *   1160px 미만은 햄버거 (전체 메뉴는 폭이 부족해 줄바꿈됨)
 */
export function SiteNav({
  strings,
  locale,
}: {
  strings: NavStrings;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  const links = [
    { href: "/#universities", label: strings.universities },
    { href: "/#cases", label: strings.cases },
    { href: "/#recruiting", label: strings.recruiting },
    { href: "/#centers", label: strings.centers },
    { href: "/about", label: strings.about },
  ];

  return (
    <>
      <header className="site-head">
        <div className="site-head-inner">
          <Link href="/" className="nav-logo" aria-label="GLOCARE" onClick={close}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/glocare-logo.png" alt="GLOCARE" width={600} height={129} />
          </Link>

          <ul className="nav-links">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={pathname === l.href ? "is-active" : undefined}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="nav-tail">
            <LangBar locale={locale} />
            {/* 헤더의 채워진 CTA 는 하나만 — 상담 신청은 히어로·푸터·메뉴에서 접근 */}
            <Link href="/student" className="nav-cta">
              {strings.studentShort}
            </Link>
            <button
              type="button"
              className={`hamburger${open ? " open" : ""}`}
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <nav className={`mob-menu${open ? " open" : ""}`} aria-label="Menu">
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={close}>
            {l.label}
          </Link>
        ))}
        <Link href="/#apply" onClick={close}>
          {strings.apply}
        </Link>
        <Link href="/student" className="mob-cta" onClick={close}>
          {strings.student}
        </Link>
      </nav>
    </>
  );
}
