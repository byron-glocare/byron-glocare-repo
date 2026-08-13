"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

export function SiteNav({
  tabs,
  loginLabel,
  authed,
  applyLabel,
  applyHref = "/service",
}: {
  tabs: Tab[];
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
