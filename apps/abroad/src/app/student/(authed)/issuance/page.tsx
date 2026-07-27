/**
 * /student/issuance — 발급 서류 대행 신청 (P3에서 커머스 구현 예정).
 *   지금은 준비 중 안내 + 서류작성으로 이탈 경로만.
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { getLocale, tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function StudentIssuancePage() {
  await verifyStudentSession();
  const locale = await getLocale();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "발급 서류 대행 신청", "Dịch vụ xin cấp giấy tờ")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "졸업·성적·가족관계 등 발급 서류를 글로케어가 대행해 드립니다.",
            "Glocare xin cấp giấy tờ (tốt nghiệp, học bạ, hộ tịch...) thay bạn."
          )}
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-slate-600">
          {tr(locale, "준비 중입니다", "Sắp ra mắt")}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {tr(
            locale,
            "곧 대학별 발급 서류를 선택해 결제·신청할 수 있게 됩니다.",
            "Sắp tới bạn có thể chọn giấy tờ theo trường, thanh toán và đặt dịch vụ."
          )}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/student/applications"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {tr(locale, "내 지원 · 서류작성", "Hồ sơ của tôi")}
          </Link>
          <Link
            href="/student/universities"
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "대학 찾기", "Tìm trường")}
          </Link>
        </div>
      </div>
    </div>
  );
}
