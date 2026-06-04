/**
 * /center/login — 유학센터 담당자 로그인.
 *   Server component → LoginForm (client) 렌더.
 *   비인증 통과 (proxy.ts 허용 경로).
 */

import Link from "next/link";

import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  no_access:
    "Tài khoản chưa được kích hoạt cho trung tâm du học. Vui lòng liên hệ GLOCARE.",
  no_org: "Trung tâm du học của bạn chưa được liên kết. Vui lòng liên hệ GLOCARE.",
  org_inactive:
    "Trung tâm du học của bạn hiện không hoạt động. Vui lòng liên hệ GLOCARE.",
};

export default async function CenterLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;
  const initialError = params.error ? ERROR_MESSAGES[params.error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight text-slate-900"
          >
            GLOCARE
          </Link>
          <p className="mt-1 text-sm text-slate-600">Cổng trung tâm du học</p>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">
            Đăng nhập
          </h1>
          <p className="mb-6 text-sm text-slate-600">
            Quản lý sinh viên và hồ sơ tuyển sinh
          </p>

          <LoginForm from={params.from} initialError={initialError} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Bạn chưa có tài khoản? Liên hệ GLOCARE để được đăng ký.
        </p>
      </div>
    </main>
  );
}
