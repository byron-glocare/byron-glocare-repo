/**
 * /center/(authed)/* — 인증 필수 라우트 그룹의 layout.
 *   첫 줄에서 verifyCenterSession() 호출 → 인증·org 검증 → 실패 시 /center/login redirect.
 *   chrome (헤더·사이드바·푸터) 는 후속 라운드에 정리.
 */

import Link from "next/link";

import { signOutCenter } from "../login/actions";
import { verifyCenterSession } from "@/lib/center/dal";

export default async function CenterAuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifyCenterSession();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/center" className="text-lg font-bold text-slate-900">
              GLOCARE Center
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/center" className="hover:text-slate-900">
                Tổng quan
              </Link>
              <Link href="/center/students" className="hover:text-slate-900">
                Sinh viên
              </Link>
              <Link href="/center/admissions" className="hover:text-slate-900">
                Tuyển sinh
              </Link>
              <Link href="/center/invoices" className="hover:text-slate-900">
                Hóa đơn
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {session.org.name_vi}
              {session.org.name_ko ? ` · ${session.org.name_ko}` : ""}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-700">
              {session.member.name}
              <span className="ml-1 text-xs text-slate-400">
                ({session.email})
              </span>
            </span>
            <form action={signOutCenter}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
