import Link from "next/link";

import { getDict } from "@/lib/i18n";

export async function SiteFooter() {
  const t = await getDict();
  return (
    <footer className="site-footer">
      <div className="foot-inner">
        <div>
          <div className="foot-logo">
            <span className="logo-text">GLOCARE</span>
          </div>
          <p className="foot-p">{t["brand.tagline"]}</p>
        </div>
        <div>
          <div className="foot-h">{t["nav.about"]}</div>
          <ul className="foot-ul">
            <li>
              <Link href="/about">{t["nav.about"]}</Link>
            </li>
            <li>
              <Link href="/partners">{t["nav.partners"]}</Link>
            </li>
            <li>
              <Link href="/ambassador">{t["nav.ambassador"]}</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="foot-h">Contact</div>
          <ul className="foot-ul">
            <li>📧 help@glocare.co.kr</li>
            <li>📞 02-456-0724</li>
            <li>오전 9시 ~ 오후 6시</li>
          </ul>
        </div>
      </div>
      <div className="foot-bot">
        <span>{t["footer.copyright"]}</span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/privacy">{t["footer.privacy"]}</Link>
          <Link href="/terms">{t["footer.terms"]}</Link>
        </div>
      </div>
    </footer>
  );
}
