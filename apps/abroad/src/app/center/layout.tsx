/**
 * 외부 어드민(/center/*) root layout.
 *
 * 베트남어 디폴트 — 본 layout 안에선 cookie locale 무시하고 항상 vi 컨텍스트.
 * (외부 어드민 한국어 토글은 후속 단계에 보강. PLAN_B Decision #5)
 *
 * 인증·org 검증은 (authed) 하위 layout 에서. /center/login·set-password 는 비인증 통과.
 *
 * 기존 root layout 의 SiteHeader/SiteFooter 가 위에 표시될 수 있음 — chrome 분리는 후속.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GLOCARE Center — Quản lý sinh viên du học",
  description:
    "Trung tâm du học đối tác — quản lý sinh viên, hồ sơ tuyển sinh, thanh toán",
  robots: { index: false, follow: false }, // 검색엔진 색인 차단
};

export default function CenterRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      lang="vi"
      className="min-h-screen bg-slate-50 text-slate-900 antialiased"
    >
      {children}
    </div>
  );
}
