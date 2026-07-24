/**
 * /student/applications — 셀프 학생의 지원 목록.
 *   지원한 대학/학과/과정 + 단계 배지. 각 항목에서 서류 작성으로 진입.
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { getLocale, tr } from "@/lib/i18n";
import {
  appStatusLabel,
  appStatusTone,
} from "@/app/center/(authed)/students/[id]/applications/status";

export const dynamic = "force-dynamic";

export default async function StudentApplicationsPage() {
  const session = await verifyStudentSession();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: apps } = await supabase
    .from("study_applications")
    .select(
      "id, admission_spec_id, offering_id, target_department_label, selected_language, status, created_at"
    )
    .eq("student_id", session.student.id)
    .order("created_at", { ascending: false });

  // spec → university 이름
  const specIds = Array.from(
    new Set((apps ?? []).map((a) => a.admission_spec_id).filter(Boolean))
  );
  const { data: specs } =
    specIds.length > 0
      ? await supabase
          .from("study_admission_specs")
          .select("id, university_id, term, program_type")
          .in("id", specIds)
      : { data: [] as Array<{ id: string; university_id: number; term: string; program_type: string }> };
  const specById = new Map((specs ?? []).map((s) => [s.id, s]));

  const uniIds = Array.from(
    new Set((specs ?? []).map((s) => s.university_id))
  );
  const { data: unis } =
    uniIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", uniIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
  const uniById = new Map((unis ?? []).map((u) => [u.id, u]));

  const rows = (apps ?? []).map((a) => {
    const spec = specById.get(a.admission_spec_id);
    const uni = spec ? uniById.get(spec.university_id) : null;
    const uniName =
      (locale === "vi" ? uni?.name_vi ?? uni?.name_ko : uni?.name_ko) ?? "—";
    return {
      id: a.id,
      universityId: spec?.university_id ?? null,
      uniName,
      dept: a.target_department_label ?? "",
      term: spec?.term ?? "",
      status: a.status,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "내 지원", "Hồ sơ của tôi")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "지원한 대학의 서류를 작성하고 진행 상황을 확인하세요.",
            "Soạn giấy tờ và theo dõi tiến độ cho trường đã đăng ký."
          )}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
          <p className="text-sm text-slate-500">
            {tr(
              locale,
              "아직 지원한 대학이 없습니다.",
              "Bạn chưa đăng ký trường nào."
            )}
          </p>
          <Link
            href="/student/universities"
            className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            {tr(locale, "대학 찾기", "Tìm trường")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {r.uniName}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {r.dept}
                    {r.term ? ` · ${r.term}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${appStatusTone(
                    r.status
                  )}`}
                >
                  {appStatusLabel(locale, r.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/student/data"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tr(locale, "정보 입력", "Nhập thông tin")}
                </Link>
                <Link
                  href="/student/final"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tr(locale, "작성 서류", "Hồ sơ soạn")}
                </Link>
                <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-xs text-slate-400">
                  {tr(locale, "서류 등록", "Tải giấy tờ")}
                  <span className="text-[10px]">
                    {tr(locale, "(준비 중)", "(sắp có)")}
                  </span>
                </span>
                {r.universityId && (
                  <Link
                    href={`/student/universities/${r.universityId}`}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    {tr(locale, "대학 정보", "Thông tin trường")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
