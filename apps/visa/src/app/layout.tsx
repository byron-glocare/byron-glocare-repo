import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한국 비자 발급 요건 조회",
  description:
    "한국 체류·입국 비자(체류자격)별 자격요건·제출서류·절차를 한눈에 조회하는 사이트.",
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
