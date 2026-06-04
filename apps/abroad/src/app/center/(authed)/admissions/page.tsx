/**
 * /center/admissions — 모집요강 조회 (유학센터 read-only).
 *   현재: 빈 자리 또는 approved spec 목록.
 *   각 행 클릭 시 /center/admissions/[id] 로 이동.
 *
 * RLS 정책: status='approved' 인 spec 만 모든 인증 사용자 조회 가능 (B1_schema.sql §5 의 specs_read_approved).
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  language_program: "Khóa tiếng (D-4)",
  associate_2yr: "Cao đẳng 2 năm",
  bachelor_3yr_extension: "Liên thông 2+2 (Cử nhân)",
  bachelor_4yr: "Cử nhân 4 năm",
};

export default async function AdmissionsPage() {
  await verifyCenterSession();
  const supabase = await createCenterClient();

  const { data: specs, error } = await supabase
    .from("study_admission_specs")
    .select(
      "id, university_id, term, program_type, departments, updated_at"
    )
    .eq("status", "approved")
    .order("updated_at", { ascending: false });

  // universities 조인 — 베트남어 라벨용
  const universityIds = Array.from(
    new Set((specs ?? []).map((s) => s.university_id))
  );
  const { data: universities } =
    universityIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", universityIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
  const uniMap = new Map(
    (universities ?? []).map((u) => [u.id, u])
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Hồ sơ tuyển sinh
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tra cứu thông tin tuyển sinh các trường đại học Hàn Quốc đã được
          GLOCARE chuẩn hóa
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </div>
      ) : !specs || specs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            Chưa có hồ sơ tuyển sinh nào được công bố.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            GLOCARE đang trong quá trình số hóa các hồ sơ tuyển sinh từ các
            trường đối tác.
            <br />
            Hồ sơ sẽ xuất hiện ở đây sau khi được duyệt.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            (Đối với GLOCARE: hồ sơ chỉ hiển thị khi <code>status = 'approved'</code>)
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-slate-700">
                  Trường đại học
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Ngành
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Chương trình
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Học kỳ
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  Cập nhật
                </th>
              </tr>
            </thead>
            <tbody>
              {specs.map((spec) => {
                const depts = (Array.isArray(spec.departments)
                  ? spec.departments
                  : []) as Array<{ name?: string }>;
                const deptNames = depts
                  .map((d) =>
                    d && typeof d === "object" && "name" in d ? d.name ?? null : null
                  )
                  .filter(Boolean) as string[];
                const uni = uniMap.get(spec.university_id);
                return (
                  <tr
                    key={spec.id}
                    className="border-t border-slate-200 transition hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={`/center/admissions/${spec.id}`}
                        className="block hover:text-emerald-700 hover:underline"
                      >
                        {uni?.name_ko ?? "—"}
                        {uni?.name_vi ? (
                          <div className="mt-0.5 text-xs font-normal text-slate-500">
                            {uni.name_vi}
                          </div>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <Link
                        href={`/center/admissions/${spec.id}`}
                        className="block"
                      >
                        {deptNames.length === 0
                          ? "—"
                          : deptNames.length === 1
                            ? deptNames[0]
                            : (
                                <>
                                  {deptNames.slice(0, 3).join(" · ")}
                                  {deptNames.length > 3 ? (
                                    <span className="text-slate-400">
                                      {" "}
                                      +{deptNames.length - 3}
                                    </span>
                                  ) : null}
                                </>
                              )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <Link
                        href={`/center/admissions/${spec.id}`}
                        className="block"
                      >
                        {PROGRAM_TYPE_LABELS[spec.program_type] ??
                          spec.program_type}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <Link
                        href={`/center/admissions/${spec.id}`}
                        className="block"
                      >
                        {spec.term}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(spec.updated_at).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
