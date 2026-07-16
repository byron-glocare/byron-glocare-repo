import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { getLocale, tr } from "@/lib/i18n";

import { StudentLogout } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function StudentAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifyStudentSession();
  const locale = await getLocale();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/student" className="font-bold text-slate-900">
            {tr(locale, "유학 지원", "Du học")}
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {session.student.name ?? session.email}
            </span>
            <StudentLogout locale={locale} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6">{children}</main>
    </div>
  );
}
