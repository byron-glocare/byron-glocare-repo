import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { getLocale, tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const name = session.student.name ?? tr(locale, "학생", "bạn");

  const cards: Array<{
    href: string;
    title: string;
    desc: string;
    ready: boolean;
  }> = [
    {
      href: "/student/universities",
      title: tr(locale, "대학 찾아 지원하기", "Tìm & đăng ký trường"),
      desc: tr(
        locale,
        "협약·자유지원 대학을 보고 지원을 시작하세요.",
        "Xem trường liên kết / tự do và bắt đầu đăng ký."
      ),
      ready: true,
    },
    {
      href: "/student/applications",
      title: tr(locale, "내 지원 · 서류 작성", "Hồ sơ của tôi"),
      desc: tr(
        locale,
        "지원한 대학의 제출 서류를 작성합니다.",
        "Soạn giấy tờ cho trường đã đăng ký."
      ),
      ready: true,
    },
    {
      href: "/student/issuance",
      title: tr(locale, "발급 서류 대행 신청", "Dịch vụ xin cấp giấy tờ"),
      desc: tr(
        locale,
        "졸업·성적·가족관계 등 발급 서류를 대행해 드립니다.",
        "Chúng tôi xin cấp giấy tờ (tốt nghiệp, học bạ, hộ tịch...) thay bạn."
      ),
      ready: false,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, `${name}님, 환영합니다`, `Xin chào ${name}`)}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "무엇을 도와드릴까요?",
            "Bạn cần hỗ trợ gì hôm nay?"
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) =>
          c.ready ? (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
            >
              <h2 className="text-sm font-semibold text-slate-900">{c.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{c.desc}</p>
            </Link>
          ) : (
            <div
              key={c.href}
              className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-5"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  {c.title}
                </h2>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {tr(locale, "준비 중", "Sắp có")}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{c.desc}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
