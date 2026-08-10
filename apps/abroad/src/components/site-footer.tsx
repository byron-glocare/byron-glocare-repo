import Link from "next/link";

import { COMPANY, companyField } from "@/lib/company";
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
              <span className="foot-k">Email</span>
              {COMPANY.email}
            </li>
            <li>
              <span className="foot-k">{t["footer.k.phone"]}</span>
              <span className="foot-v">{COMPANY.mobile}</span>
            </li>
            <li>
              <span className="foot-k">Zalo</span>
              <span className="foot-v">{COMPANY.zalo}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 사업자 정보 — 전자상거래법 고지 + 카드사 심사 하단정보 요건 */}
      <div className="foot-biz">
        <dl>
          <div>
            <dt>{t["biz.name"]}</dt>
            <dd>{COMPANY.name}</dd>
          </div>
          <div>
            <dt>{t["biz.ceo"]}</dt>
            <dd>{COMPANY.ceo}</dd>
          </div>
          <div>
            <dt>{t["biz.no"]}</dt>
            <dd className="foot-v">{COMPANY.businessNo}</dd>
          </div>
          <div>
            <dt>{t["biz.mailOrder"]}</dt>
            <dd className="foot-v">
              {companyField(COMPANY.mailOrderNo, t["biz.preparing"])}
            </dd>
          </div>
          <div>
            <dt>{t["biz.tel"]}</dt>
            <dd className="foot-v">
              {companyField(COMPANY.tel, t["biz.preparing"])}
            </dd>
          </div>
          <div className="wide">
            <dt>{t["biz.address"]}</dt>
            <dd>{COMPANY.address}</dd>
          </div>
        </dl>
      </div>

      <div className="foot-bot">
        <span>{t["footer.copyright"]}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
          <Link href="/terms">{t["footer.terms"]}</Link>
          <Link href="/privacy">{t["footer.privacy"]}</Link>
          <Link href="/refund">{t["footer.refund"]}</Link>
          <Link href="/center">{t["footer.center"]}</Link>
        </span>
      </div>
    </footer>
  );
}
