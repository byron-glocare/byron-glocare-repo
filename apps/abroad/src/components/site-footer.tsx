import Link from "next/link";

import { getDict } from "@/lib/i18n";

export async function SiteFooter() {
  const t = await getDict();

  return (
    <footer>
      <div className="foot-inner">
        <div>
          <div className="foot-logo">
            <span className="logo-text">GLOCARE</span>
          </div>
          <p className="foot-p">{t["footer.tagline"]}</p>
        </div>
        <div>
          <div className="foot-h">{t["footer.h.services"]}</div>
          <ul className="foot-ul">
            <li>
              <Link
                href="/#cases"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {t["nav.cases"]}
              </Link>
            </li>
            <li>
              <Link
                href="/#universities"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {t["nav.universities"]}
              </Link>
            </li>
            <li>
              <Link
                href="/#apply"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {t["nav.apply"]}
              </Link>
            </li>
            <li>
              <Link
                href="/#recruiting"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {t["nav.recruiting"]}
              </Link>
            </li>
            <li>
              <Link
                href="/#centers"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {t["nav.centers"]}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="foot-h">{t["footer.h.company"]}</div>
          <ul className="foot-ul">
            <li>
              <Link
                href="/about"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {t["footer.about"]}
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {t["footer.partner"]}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="foot-h">{t["footer.h.contact"]}</div>
          <ul className="foot-ul">
            <li>📧 help@glocare.co.kr</li>
            <li>📞 0977.456.324</li>
            <li>Zalo: +82-10-2256-8724</li>
          </ul>
        </div>
      </div>
      <div className="foot-bot">
        <span>{t["footer.copyright"]}</span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <span style={{ cursor: "pointer" }}>{t["footer.privacy"]}</span>
          <span style={{ cursor: "pointer" }}>{t["footer.terms"]}</span>
        </div>
      </div>
    </footer>
  );
}
