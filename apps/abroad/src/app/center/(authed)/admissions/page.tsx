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
import { getLocale, tr, type Locale } from "@/lib/i18n";

function programTypeLabel(locale: Locale, programType: string): string {
  switch (programType) {
    case "language_program":
      return tr(locale, "어학연수 (D-4)", "Khóa tiếng (D-4)");
    case "associate_2yr":
      return tr(locale, "전문학사 2년", "Cao đẳng 2 năm");
    case "bachelor_3yr_extension":
      return tr(locale, "학사 편입 2+2", "Liên thông 2+2 (Cử nhân)");
    case "bachelor_4yr":
      return tr(locale, "학사 4년", "Cử nhân 4 năm");
    default:
      return programType;
  }
}

function languageLabel(locale: Locale, lang: string): string {
  switch (lang) {
    case "korean":
      return tr(locale, "한국어", "Tiếng Hàn");
    case "english":
      return tr(locale, "영어", "Tiếng Anh");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return lang;
  }
}

function locationLabel(locale: Locale, loc: string): string {
  switch (loc) {
    case "domestic":
      return tr(locale, "국내", "Trong nước");
    case "overseas":
      return tr(locale, "해외", "Ngoài nước");
    default:
      return loc;
  }
}

export default async function AdmissionsPage() {
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();
  const dateLocale = locale === "ko" ? "ko-KR" : "vi-VN";

  const [{ data: specs, error }, { data: offerings }] = await Promise.all([
    supabase
      .from("study_admission_specs")
      .select("id, university_id, term, program_type, departments, updated_at")
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
    // 모집 중(글로케어가 실제로 모집하는) offering — RLS 가 published 만 노출
    supabase
      .from("study_offerings")
      .select(
        "id, university_id, department_id, term, intake_quota, available_languages, location_options, sort_order"
      )
      .eq("status", "published"),
  ]);

  // universities 조인 — 베트남어 라벨용 (specs + offerings 의 모든 대학)
  const universityIds = Array.from(
    new Set([
      ...(specs ?? []).map((s) => s.university_id),
      ...(offerings ?? []).map((o) => o.university_id),
    ])
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

  // offering 의 학과명 조인
  const offeringDeptIds = Array.from(
    new Set((offerings ?? []).map((o) => o.department_id))
  );
  const { data: offeringDepts } =
    offeringDeptIds.length > 0
      ? await supabase
          .from("departments")
          .select("id, name_ko, name_vi")
          .in("id", offeringDeptIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
  const deptMap = new Map((offeringDepts ?? []).map((d) => [d.id, d]));

  const sortedOfferings = (offerings ?? [])
    .slice()
    .sort(
      (a, b) =>
        b.term.localeCompare(a.term) ||
        a.sort_order - b.sort_order ||
        (uniMap.get(a.university_id)?.name_ko ?? "").localeCompare(
          uniMap.get(b.university_id)?.name_ko ?? "",
          "ko"
        )
    );

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {tr(locale, "모집요강", "Hồ sơ tuyển sinh")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "GLOCARE가 표준화한 한국 대학 모집요강 정보를 조회하세요",
            "Tra cứu thông tin tuyển sinh các trường đại học Hàn Quốc đã được GLOCARE chuẩn hóa"
          )}
        </p>
      </header>

      {/* 모집 중 — 글로케어가 실제로 모집하는 학과/학기 + 모집수 */}
      {sortedOfferings.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            {tr(locale, "모집 중", "Đang tuyển sinh")}
            <span className="ml-2 text-sm font-normal text-slate-500">
              {tr(
                locale,
                "GLOCARE가 이번 학기에 모집하는 학과입니다",
                "Các ngành GLOCARE đang tuyển trong học kỳ này"
              )}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedOfferings.map((o) => {
              const uni = uniMap.get(o.university_id);
              const dept = deptMap.get(o.department_id);
              const uniName =
                (locale === "ko" ? uni?.name_ko : uni?.name_vi) ??
                uni?.name_ko ??
                "—";
              const deptName =
                (locale === "ko" ? dept?.name_ko : dept?.name_vi) ??
                dept?.name_ko ??
                "—";
              const langs = (o.available_languages ?? []) as string[];
              const locs = (o.location_options ?? []) as string[];
              return (
                <div
                  key={o.id}
                  className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"
                >
                  <div className="text-xs font-medium text-emerald-700">
                    {uniName}
                  </div>
                  <div className="mt-0.5 font-semibold text-slate-900">
                    {deptName}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200">
                      {o.term}
                    </span>
                    {langs.map((l) => (
                      <span
                        key={l}
                        className="rounded bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200"
                      >
                        {languageLabel(locale, l)}
                      </span>
                    ))}
                    {locs.length > 0 ? (
                      <span className="rounded bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200">
                        {locs.map((l) => locationLabel(locale, l)).join("/")}
                      </span>
                    ) : null}
                    {o.intake_quota != null ? (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-medium text-white">
                        {tr(locale, "모집 ", "Tuyển ")}
                        {o.intake_quota}
                        {tr(locale, "명", " SV")}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {sortedOfferings.length > 0 ? (
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          {tr(locale, "모집요강 상세", "Chi tiết hồ sơ tuyển sinh")}
        </h2>
      ) : null}

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {tr(locale, "데이터 로드 오류", "Lỗi tải dữ liệu")}: {error.message}
        </div>
      ) : !specs || specs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            {tr(
              locale,
              "공개된 모집요강이 없습니다.",
              "Chưa có hồ sơ tuyển sinh nào được công bố."
            )}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tr(
              locale,
              "GLOCARE가 파트너 대학의 모집요강을 디지털화하는 중입니다.",
              "GLOCARE đang trong quá trình số hóa các hồ sơ tuyển sinh từ các trường đối tác."
            )}
            <br />
            {tr(
              locale,
              "승인되면 이곳에 표시됩니다.",
              "Hồ sơ sẽ xuất hiện ở đây sau khi được duyệt."
            )}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            {tr(
              locale,
              "(GLOCARE 안내: 모집요강은 ",
              "(Đối với GLOCARE: hồ sơ chỉ hiển thị khi "
            )}
            <code>status = 'approved'</code>
            {tr(locale, " 일 때만 표시됩니다)", ")")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "대학교", "Trường đại học")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "학과", "Ngành")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "과정", "Chương trình")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "학기", "Học kỳ")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "수정일", "Cập nhật")}
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
                        {(locale === "ko" ? uni?.name_ko : uni?.name_vi) ??
                          uni?.name_ko ??
                          "—"}
                        {(locale === "ko" ? uni?.name_vi : uni?.name_ko) ? (
                          <div className="mt-0.5 text-xs font-normal text-slate-500">
                            {locale === "ko" ? uni?.name_vi : uni?.name_ko}
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
                        {programTypeLabel(locale, spec.program_type)}
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
                      {new Date(spec.updated_at).toLocaleDateString(dateLocale)}
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
