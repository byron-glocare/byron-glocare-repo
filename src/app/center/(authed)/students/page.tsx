/**
 * /center/students — 학생 목록.
 *   RLS 가 본인 org 의 학생만 자동 필터.
 *   향후: 검색 / 단계·대학·마감일 필터 / 페이지네이션 (B1 후반)
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

import { StudentsFilterBar } from "./students-filter-bar";

const VISA_LABELS: Record<string, string> = {
  "D-4": "D-4 (어학)",
  "D-2": "D-2 (유학)",
  none: "Chưa có",
  other: "Khác",
};

const LOCATION_LABELS: Record<string, string> = {
  VN: "Việt Nam",
  KR: "Hàn Quốc",
  other: "Khác",
};

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

  await verifyCenterSession(); // 인증 + org 검증
  const supabase = await createCenterClient();

  let query = supabase
    .from("study_managed_students")
    .select(
      "id, name, dob, phone, email, topik_level, current_visa, location, notes, created_at"
    )
    .order("created_at", { ascending: false });

  if (q && q.trim()) {
    // PostgREST or 검색 — name·email·passport(암호화전 평문)
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
  if (visa) query = query.eq("current_visa", visa);
  if (location) query = query.eq("location", location);

  const { data: students, error } = await query;
  const hasFilter = !!(q || topik || visa || location);

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Danh sách sinh viên
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {students && students.length > 0
              ? hasFilter
                ? `Tìm thấy ${students.length} sinh viên`
                : `${students.length} sinh viên · Quản lý hồ sơ du học Hàn Quốc`
              : "Quản lý hồ sơ sinh viên đăng ký du học Hàn Quốc"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/center/students/import"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Tải lên Excel
          </Link>
          <Link
            href="/center/students/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + Đăng ký sinh viên
          </Link>
        </div>
      </header>

      <StudentsFilterBar />

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </div>
      ) : !students || students.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          {hasFilter ? (
            <>
              <p className="text-base text-slate-600">
                Không tìm thấy sinh viên nào khớp với bộ lọc.
              </p>
              <Link
                href="/center/students"
                className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
              >
                Xóa bộ lọc và xem tất cả →
              </Link>
            </>
          ) : (
            <>
              <p className="text-base text-slate-600">
                Chưa có sinh viên nào được đăng ký.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Bắt đầu bằng cách đăng ký sinh viên đầu tiên.
              </p>
              <Link
                href="/center/students/new"
                className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + Đăng ký sinh viên đầu tiên
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
                  Họ tên
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Ngày sinh
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Liên hệ
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">TOPIK</th>
                <th className="px-4 py-3 font-medium text-slate-700">Visa</th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Vị trí
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Đăng ký
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
                  <td className="px-4 py-3 text-slate-700">
                    {s.dob ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.phone ?? s.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.topik_level ? `Cấp ${s.topik_level}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.current_visa
                      ? (VISA_LABELS[s.current_visa] ?? s.current_visa)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.location
                      ? (LOCATION_LABELS[s.location] ?? s.location)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(s.created_at).toLocaleDateString("vi-VN")}
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
