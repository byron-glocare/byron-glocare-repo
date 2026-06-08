/**
 * /center/(authed)/* — 인증 필수 라우트 그룹의 layout.
 *   첫 줄에서 verifyCenterSession() 호출 → 인증·org 검증 → 실패 시 /center/login redirect.
 *   chrome (헤더·사이드바·푸터) 는 후속 라운드에 정리.
 */

import Link from "next/link";

import { signOutCenter } from "../login/actions";
import { verifyCenterSession } from "@/lib/center/dal";
import { getLocale, t } from "@/lib/i18n";

import { LocaleToggle } from "./locale-toggle";

export default async function CenterAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifyCenterSession();
  const locale = await getLocale();

  const navItems = [
    { href: "/center", label: t(locale, "center.nav.overview") },
    { href: "/center/students", label: t(locale, "center.nav.students") },
    { href: "/center/admissions", label: t(locale, "center.nav.admissions") },
    { href: "/center/invoices", label: t(locale, "center.nav.invoices") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex w-full flex-nowrap items-center justify-between gap-x-8 px-6 py-3.5 lg:px-10">
          <div className="flex min-w-0 items-center gap-10">
            <Link
              href="/center"
              className="shrink-0 text-lg font-bold tracking-tight text-slate-900"
            >
              {t(locale, "center.brand")}
            </Link>
            <nav className="flex items-center gap-7 text-sm font-medium text-slate-600">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap px-1 py-1 transition-colors hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-sm">
            <LocaleToggle current={locale} />
            <span className="hidden max-w-[18rem] truncate text-slate-600 lg:inline">
              {session.org.name_vi}
              {session.org.name_ko ? ` · ${session.org.name_ko}` : ""}
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span className="hidden text-slate-700 md:inline">
              {session.member.name}
            </span>
            <form action={signOutCenter}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {t(locale, "center.logout")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
