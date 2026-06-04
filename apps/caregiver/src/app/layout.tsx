import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import { LangBar } from "@/components/lang-bar";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { UnmappedBanner } from "@/components/unmapped-banner";
import { getAuthState } from "@/lib/auth";
import { getLocale, getDictByLocale } from "@/lib/i18n";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-be-vietnam",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-kr",
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-noto-serif-kr",
});

export const metadata: Metadata = {
  title: "GLOCARE — 외국인 요양보호사 자격 취득 지원",
  description:
    "GLOCARE đồng hành cùng điều dưỡng viên người nước ngoài — từ chứng chỉ đến việc làm.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const t = getDictByLocale(locale);
  const auth = await getAuthState();
  const authed = auth.kind !== "guest";

  const tabs = [
    { href: "/", label: t["nav.home"] },
    { href: "/about", label: t["nav.about"] },
    { href: "/videos", label: t["nav.videos"] },
    { href: "/cbt", label: t["nav.cbt"] },
    { href: "/partners", label: t["nav.partners"] },
    { href: "/ambassador", label: t["nav.ambassador"] },
    { href: "/resume", label: t["nav.resume"] },
    ...(authed ? [{ href: "/profile", label: t["nav.profile"] }] : []),
  ];

  return (
    <html
      lang={locale}
      className={`${beVietnam.variable} ${notoSansKr.variable} ${notoSerifKr.variable}`}
    >
      <body>
        <LangBar locale={locale} />
        <SiteNav tabs={tabs} loginLabel={t["nav.login"]} authed={authed} />
        {auth.kind === "unmapped" && <UnmappedBanner locale={locale} />}
        <main>{children}</main>
        <SiteFooter />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
