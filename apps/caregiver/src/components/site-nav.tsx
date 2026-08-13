"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LangBar } from "@/components/lang-bar";
import type { Locale } from "@/lib/i18n";

type Tab = { href: string; label: string };

export function SiteNav({
  tabs,
  locale,
  loginLabel,
  authed,
  applyLabel,
  applyHref = "/service",
}: {
  tabs: Tab[];
  locale: Locale;
  loginLabel: string;
  authed: boolean;
  applyLabel?: string;
  applyHref?: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <nav className="site-nav">
      <Link href="/" className="nav-logo" aria-label="GLOCARE">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/glocare-logo.png" alt="GLOCARE" width={600} height={129} />
      </Link>
      <ul className="nav-tabs">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className={isActive(t.href) ? "active" : ""}>
              {t.label}
            </Link>
          </li>
        ))}
        <li style={{ display: "flex", alignItems: "center", marginLeft: "0.3rem" }}>
          <LangBar locale={locale} />
        </li>
        {!authed && (
          <li>
            <Link
              href="/login"
              className={isActive("/login") ? "active" : ""}
              style={{
                background: "var(--gc-surface)",
                color: "var(--gc-ink-900)",
                border: "1.5px solid var(--gc-ink-300)",
                fontWeight: 600,
              }}
            >
              {loginLabel}
            </Link>
          </li>
        )}
        {!authed && applyLabel && (
          <li>
            <Link
              href={applyHref}
              style={{
                background: "var(--gc-primary-500)",
                color: "var(--gc-surface)",
                fontWeight: 700,
              }}
            >
              {applyLabel}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
