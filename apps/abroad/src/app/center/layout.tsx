/**
 * 외부 어드민(/center/*) root layout.
 *
 * 화면 언어는 cookie locale 을 따른다(상단 VI/KO 토글). 기본값은 vi.
 *
 * 인증·org 검증은 (authed) 하위 layout 에서. /center/login·set-password 는 비인증 통과.
 *
 * 기존 root layout 의 SiteHeader/SiteFooter 가 위에 표시될 수 있음 — chrome 분리는 후속.
 */

import type { Metadata } from "next";

import { getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "GLOCARE Center — 유학센터 포털",
  description: "유학센터 파트너 포털 — 학생·모집요강·청구 관리",
  robots: { index: false, follow: false }, // 검색엔진 색인 차단
};

export default async function CenterRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <div
      lang={locale}
      className="min-h-screen bg-slate-50 text-slate-900 antialiased"
    >
      {children}
    </div>
  );
}
