import Link from "next/link";

import { getDict } from "@/lib/i18n";

/** 푸터 — ink-900 면 4열. 연락처는 이모지 대신 라벨(스크린리더에도 읽힘). */
export async function SiteFooter() {
  const t = await getDict();

  const services = [
    { href: "/#cases", label: t["nav.cases"] },
    { href: "/#apply", label: t["nav.applySection"] },
    { href: "/#universities", label: t["nav.universities"] },
    { href: "/#recruiting", label: t["nav.recruiting"] },
    { href: "/#centers", label: t["nav.centers"] },
  ];

  return (
    <footer>
      <div className="foot-inner">
        <div>
          <div className="foot-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/glocare-logo.png" alt="GLOCARE" width={600} height={129} />
          </div>
          <p className="foot-p">{t["footer.tagline"]}</p>
        </div>

        <div>
          <div className="foot-h">{t["footer.h.services"]}</div>
          <ul className="foot-ul">
            {services.map((s) => (
              <li key={s.href}>
                <Link href={s.href}>{s.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="foot-h">{t["footer.h.company"]}</div>
          <ul className="foot-ul">
            <li>
              <Link href="/about">{t["footer.about"]}</Link>
            </li>
            <li>
              <Link href="/apply">{t["footer.partner"]}</Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="foot-h">{t["footer.h.contact"]}</div>
          <ul className="foot-ul">
            <li>
              <span className="foot-k">Email</span>help@glocare.co.kr
            </li>
            <li>
              <span className="foot-k">{t["footer.k.phone"]}</span>
              <span className="foot-v">0977.456.324</span>
            </li>
            <li>
              <span className="foot-k">Zalo</span>
              <span className="foot-v">+82-10-2256-8724</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="foot-bot">
        <span>{t["footer.copyright"]}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
          <Link href="/about">{t["footer.privacy"]}</Link>
          <Link href="/about">{t["footer.terms"]}</Link>
          <Link href="/center">{t["footer.center"]}</Link>
        </span>
      </div>
    </footer>
  );
}
