import { Suspense } from "react";

import { getLocale, tr } from "@/lib/i18n";
import { getStudentSession } from "@/lib/student/dal";
import { redirect } from "next/navigation";

import { StudentLoginButtons } from "./login-buttons";

export const dynamic = "force-dynamic";

export default async function StudentLoginPage() {
  // 이미 로그인 + 학생행 있으면 대시보드로
  const session = await getStudentSession();
  if (session) redirect("/student");
  const locale = await getLocale();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          {tr(locale, "유학 지원 시작하기", "Bắt đầu đăng ký du học")}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {tr(
            locale,
            "구글 계정으로 가입하면 대학 지원 서류를 바로 작성할 수 있습니다.",
            "Đăng ký bằng tài khoản Google để soạn hồ sơ du học ngay."
          )}
        </p>

        <div className="mt-6">
          <Suspense>
            <StudentLoginButtons locale={locale} />
          </Suspense>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          {tr(
            locale,
            "가입 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.",
            "Khi đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật."
          )}
        </p>
      </div>
    </div>
  );
}
