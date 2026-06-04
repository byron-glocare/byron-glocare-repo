/**
 * Root layout — minimal.
 *
 * 공개 사이트 chrome (SiteHeader/Footer) 는 `src/app/(site)/layout.tsx` 로 분리.
 * 외부 어드민(/center/*) chrome 은 `src/app/center/layout.tsx` 에서 별도 처리.
 * 본 layout 은 html/body/font + 전역 Toaster 만.
 */

import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import { getLocale } from "@/lib/i18n";

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
  title: "GLOCARE — Du học Hàn Quốc có việc làm đảm bảo",
  description:
    "Glocare đồng hành cùng học sinh Việt Nam du học Hàn Quốc — trường đại học, ngành học, hỗ trợ visa, việc làm.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${beVietnam.variable} ${notoSansKr.variable} ${notoSerifKr.variable}`}
    >
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
