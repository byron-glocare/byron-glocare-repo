/**
 * /center/admissions — 모집 조회 (유학센터 read-only).
 *   글로케어가 **노출(published)** 한 모집(offering)만 보여준다.
 *   모집중이 아닌 대학/학과/학기(approved spec 직접 노출)는 더 이상 표시하지 않는다.
 *   각 카드 클릭 시 그 모집요강 상세(/center/admissions/[specId]) 로 이동.
 *
 * RLS: study_offerings 는 status='published' 만 인증 사용자 조회 가능(offering_authed_read).
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";

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

export default async function AdmissionsPage() {
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  // 모집 중(published) offering 만 노출
  const { data: offerings, error } = await supabase
    .from("study_offerings")
    .select(
      "id, university_id, department_id, term, intake_quota, available_languages, source_spec_id, sort_order"
    )
    .eq("status", "published");

  // 대학·학과명 조인
  const universityIds = Array.from(
    new Set((offerings ?? []).map((o) => o.university_id))
  );
  const offeringDeptIds = Array.from(
    new Set((offerings ?? []).map((o) => o.department_id))
  );
  const [{ data: universities }, { data: offeringDepts }] = await Promise.all([
    universityIds.length > 0
      ? supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", universityIds)
      : Promise.resolve({
          data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }>,
        }),
    offeringDeptIds.length > 0
      ? supabase
          .from("departments")
          .select("id, name_ko, name_vi")
          .in("id", offeringDeptIds)
      : Promise.resolve({
          data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }>,
        }),
  ]);
  const uniMap = new Map((universities ?? []).map((u) => [u.id, u]));
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
          {tr(locale, "모집 중", "Đang tuyển sinh")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "GLOCARE가 이번 학기에 모집하는 대학·학과입니다. 카드를 눌러 상세 모집요강을 확인하세요.",
            "Các trường·ngành GLOCARE đang tuyển kỳ này. Nhấn vào thẻ để xem chi tiết hồ sơ tuyển sinh."
          )}
        </p>
      </header>

      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {tr(locale, "데이터 로드 오류", "Lỗi tải dữ liệu")}: {error.message}
        </div>
      ) : sortedOfferings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            {tr(
              locale,
              "현재 모집 중인 학과가 없습니다.",
              "Hiện chưa có ngành nào đang tuyển sinh."
            )}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tr(
              locale,
              "GLOCARE가 이번 학기 모집을 준비 중입니다. 공개되면 이곳에 표시됩니다.",
              "GLOCARE đang chuẩn bị tuyển sinh kỳ này. Sẽ hiển thị ở đây khi được công bố."
            )}
          </p>
        </div>
      ) : (
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

            const inner = (
              <>
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
                  {o.intake_quota != null ? (
                    <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-medium text-white">
                      {tr(locale, "모집 ", "Tuyển ")}
                      {o.intake_quota}
                      {tr(locale, "명", " SV")}
                    </span>
                  ) : null}
                </div>
              </>
            );

            return o.source_spec_id ? (
              <Link
                key={o.id}
                href={`/center/admissions/${o.source_spec_id}`}
                className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={o.id}
                className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
