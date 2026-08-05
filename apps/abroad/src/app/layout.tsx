/**
 * Root layout — minimal.
 *
 * 공개 사이트 chrome (SiteHeader/Footer) 는 `src/app/(site)/layout.tsx` 로 분리.
 * 외부 어드민(/center/*) chrome 은 `src/app/center/layout.tsx` 에서 별도 처리.
 * 본 layout 은 html/body/font + 전역 Toaster 만.
 */

import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import { getLocale } from "@/lib/i18n";

/* 디자인 시스템 폰트 — 본문·제목·UI 전체는 Be Vietnam Pro(한글 구간은 Noto Sans KR),
   자리수를 세는 숫자(전화번호·금액·통계)만 JetBrains Mono. 세리프는 쓰지 않는다. */
const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-be-vietnam",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-kr",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-jetbrains",
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
      className={`${beVietnam.variable} ${notoSansKr.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
