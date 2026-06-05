/**
 * /center — 유학센터 대시보드.
 *   본인 org(RLS)의 학생/지원 요약 통계 카드 + 빠른 이동. (VI 기본 / KO 토글)
 */

import Link from "next/link";

import { verifyCenterSession, isCenterAdmin } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";

const ACTIVE_APP_STATUSES = [
  "preparing",
  "ready_for_review",
  "reviewing",
  "revisions_required",
  "submitted",
];

export default async function CenterDashboardPage() {
  const session = await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  const [{ count: studentCount }, { data: appsRaw }] = await Promise.all([
    supabase
      .from("study_managed_students")
      .select("id", { count: "exact", head: true }),
    supabase.from("study_applications").select("id, status, next_deadline"),
  ]);

  const apps = appsRaw ?? [];
  const inProgress = apps.filter((a) =>
    ACTIVE_APP_STATUSES.includes(a.status)
  ).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const dueSoon = apps.filter((a) => {
    if (!a.next_deadline) return false;
    const d = new Date(a.next_deadline);
    return d >= today && d <= in7;
  }).length;

  const orgName =
    locale === "ko" && session.org.name_ko
      ? session.org.name_ko
      : session.org.name_vi;

  const stats = [
    {
      label: tr(locale, "학생", "Sinh viên"),
      value: studentCount ?? 0,
      href: "/center/students",
      accent: "text-emerald-600",
    },
    {
      label: tr(locale, "진행 중 지원", "Đơn đang xử lý"),
      value: inProgress,
      href: "/center/students",
      accent: "text-indigo-600",
    },
    {
      label: tr(locale, "마감 임박 (7일 내)", "Sắp đến hạn (7 ngày)"),
      value: dueSoon,
      href: "/center/students",
      accent: dueSoon > 0 ? "text-amber-600" : "text-slate-400",
    },
  ];

  const quickLinks = [
    {
      href: "/center/students",
      title: tr(locale, "학생", "Sinh viên"),
      desc: tr(locale, "등록 · 서류 · 상세 정보", "Đăng ký, hồ sơ, thông tin chi tiết"),
    },
    {
      href: "/center/admissions",
      title: tr(locale, "모집요강", "Tuyển sinh"),
      desc: tr(
        locale,
        "대학별 입학서류 조회",
        "Tra cứu hồ sơ tuyển sinh các trường"
      ),
    },
    {
      href: "/center/invoices",
      title: tr(locale, "청구서", "Hóa đơn"),
      desc: tr(locale, "결제 · 정산", "Thanh toán & đối soát"),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {tr(
            locale,
            `${session.member.name}님, 환영합니다`,
            `Chào mừng, ${session.member.name}`
          )}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {orgName} · {tr(locale, "역할", "Vai trò")}:{" "}
          {isCenterAdmin(session)
            ? tr(locale, "관리자", "Quản trị viên")
            : tr(locale, "사용자", "Người dùng")}
        </p>
      </header>

      {/* 요약 통계 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-sm"
          >
            <div className="text-sm font-medium text-slate-600">{s.label}</div>
            <div className={`mt-3 text-3xl font-bold ${s.accent}`}>
              {s.value}
            </div>
          </Link>
        ))}
      </section>

      {/* 빠른 이동 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {tr(locale, "빠른 이동", "Truy cập nhanh")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickLinks.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="text-base font-semibold text-slate-900 group-hover:text-slate-700">
                {q.title}
              </div>
              <p className="mt-1 text-sm text-slate-500">{q.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
