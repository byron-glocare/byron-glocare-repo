"use client";

import Link from "next/link";
import { useState } from "react";

type NavStrings = {
  cases: string;
  universities: string;
  recruiting: string;
  centers: string;
  insurance: string;
  about: string;
  apply: string;
};

export function SiteNav({ strings }: { strings: NavStrings }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <nav>
        <Link
          href="/"
          className="nav-logo"
          aria-label="GLOCARE"
          onClick={close}
        >
          <span className="logo-text">GLOCARE</span>
        </Link>
        <ul className="nav-links">
          <li>
            <Link href="/#cases">{strings.cases}</Link>
          </li>
          <li>
            <Link href="/#universities">{strings.universities}</Link>
          </li>
          <li>
            <Link href="/#recruiting">{strings.recruiting}</Link>
          </li>
          <li>
            <Link href="/#centers">{strings.centers}</Link>
          </li>
          <li>
            <Link
              href="/#insurance-refund"
              style={{ color: "var(--coral)", fontWeight: 800 }}
            >
              {strings.insurance}
            </Link>
          </li>
          <li>
            <Link
              href="/about"
              style={{
                color: "var(--coral)",
                fontWeight: 700,
                border: "1.5px solid var(--coral)",
                padding: "4px 12px",
                borderRadius: "16px",
              }}
            >
              {strings.about}
            </Link>
          </li>
          <li>
            <Link href="/#apply" className="nav-cta">
              {strings.apply}
            </Link>
          </li>
        </ul>
        <button
          type="button"
          className={`hamburger${open ? " open" : ""}`}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>
      <div className={`mob-menu${open ? " open" : ""}`}>
        <Link href="/#cases" onClick={close}>
          {strings.cases}
        </Link>
        <Link href="/#universities" onClick={close}>
          {strings.universities}
        </Link>
        <Link href="/#recruiting" onClick={close}>
          {strings.recruiting}
        </Link>
        <Link href="/#centers" onClick={close}>
          {strings.centers}
        </Link>
        <Link
          href="/#insurance-refund"
          onClick={close}
          style={{ color: "var(--coral)", fontWeight: 800 }}
        >
          {strings.insurance}
        </Link>
        <Link href="/about" onClick={close}>
          {strings.about}
        </Link>
        <Link href="/#apply" className="mob-cta" onClick={close}>
          {strings.apply}
        </Link>
      </div>
    </>
  );
}
