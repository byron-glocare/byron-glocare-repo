/**
 * (site) route group layout — 공개 홈페이지 chrome.
 *
 * 적용 페이지: /, /apply, /insurance, /universities, /centers, /cases, /about
 * (URL 에 (site) 는 안 나타남 — route group)
 *
 * /center/* 에는 본 layout 적용 X — chrome 두 겹 문제 해결.
 */

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getLocale } from "@/lib/i18n";

export default async function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <>
      <SiteHeader locale={locale} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
