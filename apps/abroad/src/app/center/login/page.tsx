/**
 * /center/login — 유학센터 담당자 로그인.
 *   Server component → LoginForm (client) 렌더.
 *   비인증 통과 (proxy.ts 허용 경로).
 */

import Link from "next/link";

import { getLocale, tr } from "@/lib/i18n";

import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, [string, string]> = {
  no_access: [
    "유학센터 계정으로 활성화되지 않았습니다. 글로케어로 문의해 주세요.",
    "Tài khoản chưa được kích hoạt cho trung tâm du học. Vui lòng liên hệ GLOCARE.",
  ],
  no_org: [
    "소속 유학센터가 연결되지 않았습니다. 글로케어로 문의해 주세요.",
    "Trung tâm du học của bạn chưa được liên kết. Vui lòng liên hệ GLOCARE.",
  ],
  org_inactive: [
    "소속 유학센터가 현재 비활성 상태입니다. 글로케어로 문의해 주세요.",
    "Trung tâm du học của bạn hiện không hoạt động. Vui lòng liên hệ GLOCARE.",
  ],
};

export default async function CenterLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const msg = params.error ? ERROR_MESSAGES[params.error] : undefined;
  const initialError = msg ? (locale === "ko" ? msg[0] : msg[1]) : undefined;

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
          <p className="mt-1 text-sm text-slate-600">
            {tr(locale, "유학센터 포털", "Cổng trung tâm du học")}
          </p>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">
            {tr(locale, "로그인", "Đăng nhập")}
          </h1>
          <p className="mb-6 text-sm text-slate-600">
            {tr(locale, "학생·모집요강 관리", "Quản lý sinh viên và hồ sơ tuyển sinh")}
          </p>

          <LoginForm
            locale={locale}
            from={params.from}
            initialError={initialError}
          />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          {tr(
            locale,
            "계정이 없으신가요? 글로케어로 문의해 등록하세요.",
            "Bạn chưa có tài khoản? Liên hệ GLOCARE để được đăng ký."
          )}
        </p>
      </div>
    </main>
  );
}
