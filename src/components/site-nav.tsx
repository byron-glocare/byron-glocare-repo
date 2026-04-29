"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

export function SiteNav({
  tabs,
  loginLabel,
  authed,
}: {
  tabs: Tab[];
  loginLabel: string;
  authed: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <nav className="site-nav">
      <Link href="/" className="nav-logo" aria-label="GLOCARE">
        <span className="logo-text">GLOCARE</span>
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
              style={{ background: "var(--coral-pale)", color: "var(--coral)" }}
            >
              {loginLabel}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
