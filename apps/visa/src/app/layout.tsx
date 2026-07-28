import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한국 유학비자 발급요건 조회 (D-2 / D-4)",
  description:
    "베트남 국적 중심 한국 유학비자(D-2·D-4) 발급요건 판정기 — 신청 상황을 선택하면 적용 조항을 실시간 조회.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
