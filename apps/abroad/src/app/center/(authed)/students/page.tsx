/**
 * /center/students — 학생 목록. (VI 기본 / KO 토글)
 *   RLS 가 본인 org 의 학생만 자동 필터.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import type {
  ManagedStudentVisa,
  ManagedStudentLocation,
} from "@/types/study";

import { StudentsFilterBar } from "./students-filter-bar";

function visaLabel(locale: Locale, visa: string): string {
  switch (visa) {
    case "D-4":
      return "D-4";
    case "D-2":
      return "D-2";
    case "none":
      return tr(locale, "없음", "Chưa có");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return visa;
  }
}

function locationLabel(locale: Locale, loc: string): string {
  switch (loc) {
    case "VN":
      return tr(locale, "베트남", "Việt Nam");
    case "KR":
      return tr(locale, "한국", "Hàn Quốc");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return loc;
  }
}

type SearchParams = {
  q?: string;
  topik?: string;
  visa?: string;
  location?: string;
};

export default async function StudentsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, topik, visa, location } = await searchParams;

  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  let query = supabase
    .from("study_managed_students")
    .select(
      "id, name, dob, phone, email, topik_level, current_visa, location, notes, created_at"
    )
    .order("created_at", { ascending: false });

  if (q && q.trim()) {
    const term = q.trim().replace(/[%_,()]/g, " ");
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,passport_no_encrypted.ilike.%${term}%`
    );
  }
  if (topik === "__none__") {
    query = query.is("topik_level", null);
  } else if (topik) {
    query = query.eq("topik_level", topik);
  }
  if (visa) query = query.eq("current_visa", visa as ManagedStudentVisa);
  if (location)
    query = query.eq("location", location as ManagedStudentLocation);

  const { data: students, error } = await query;
  const hasFilter = !!(q || topik || visa || location);
  const dateLocale = locale === "ko" ? "ko-KR" : "vi-VN";

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {tr(locale, "학생 목록", "Danh sách sinh viên")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {students && students.length > 0
              ? hasFilter
                ? tr(
                    locale,
                    `${students.length}명 검색됨`,
                    `Tìm thấy ${students.length} sinh viên`
                  )
                : tr(
                    locale,
                    `학생 ${students.length}명 · 한국 유학 지원 관리`,
                    `${students.length} sinh viên · Quản lý hồ sơ du học Hàn Quốc`
                  )
              : tr(
                  locale,
                  "한국 유학 지원 학생 관리",
                  "Quản lý hồ sơ sinh viên đăng ký du học Hàn Quốc"
                )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/center/students/import"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "엑셀 업로드", "Tải lên Excel")}
          </Link>
          <Link
            href="/center/students/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {tr(locale, "+ 학생 등록", "+ Đăng ký sinh viên")}
          </Link>
        </div>
      </header>

      <StudentsFilterBar locale={locale} />

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {tr(locale, "데이터 로드 오류", "Lỗi tải dữ liệu")}: {error.message}
        </div>
      ) : !students || students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          {hasFilter ? (
            <>
              <p className="text-base text-slate-600">
                {tr(
                  locale,
                  "필터에 맞는 학생이 없습니다.",
                  "Không tìm thấy sinh viên nào khớp với bộ lọc."
                )}
              </p>
              <Link
                href="/center/students"
                className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
              >
                {tr(
                  locale,
                  "필터 지우고 전체 보기 →",
                  "Xóa bộ lọc và xem tất cả →"
                )}
              </Link>
            </>
          ) : (
            <>
              <p className="text-base text-slate-600">
                {tr(
                  locale,
                  "아직 등록된 학생이 없습니다.",
                  "Chưa có sinh viên nào được đăng ký."
                )}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {tr(
                  locale,
                  "첫 학생을 등록해 시작하세요.",
                  "Bắt đầu bằng cách đăng ký sinh viên đầu tiên."
                )}
              </p>
              <Link
                href="/center/students/new"
                className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {tr(
                  locale,
                  "+ 첫 학생 등록",
                  "+ Đăng ký sinh viên đầu tiên"
                )}
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "이름", "Họ tên")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "생년월일", "Ngày sinh")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "연락처", "Liên hệ")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">TOPIK</th>
                <th className="px-4 py-3 font-medium text-slate-700">Visa</th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "위치", "Vị trí")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "등록일", "Đăng ký")}
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      href={`/center/students/${s.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.dob ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.phone ?? s.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.topik_level
                      ? tr(locale, `${s.topik_level}급`, `Cấp ${s.topik_level}`)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.current_visa ? visaLabel(locale, s.current_visa) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.location ? locationLabel(locale, s.location) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(s.created_at).toLocaleDateString(dateLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
