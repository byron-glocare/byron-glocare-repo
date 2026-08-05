import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { getLocale, tr } from "@/lib/i18n";

import { StudentLogout } from "./logout-button";
import { StudentNav } from "./student-nav";

export const dynamic = "force-dynamic";

/**
 * 학생 포털 셸 — 공개 사이트와 같은 디자인 시스템 골격.
 *   68px sticky 헤더 + 1120 컨테이너, 그 아래 pill 탭 네비.
 */
export default async function StudentAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifyStudentSession();
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="site-head">
        <div className="site-head-inner">
          <Link href="/student" className="nav-logo">
            <span className="logo-text">
              {tr(locale, "유학 지원", "Du học")}
            </span>
          </Link>
          <div className="nav-tail">
            <span className="text-xs text-ink-light">
              {session.student.name ?? session.email}
            </span>
            <StudentLogout locale={locale} />
          </div>
        </div>
        <StudentNav locale={locale} />
      </header>

      <main className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
