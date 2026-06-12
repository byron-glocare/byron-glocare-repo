/**
 * /center/students/[id]/select — 대학 선택 탭.
 *   학생의 지원(희망 대학/학과/학기) 등록·관리.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";

import { StatusSelect } from "../applications/status-select";
import { DeleteApplicationButton } from "../applications/delete-application-button";

export default async function SelectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();
  const dateLocale = locale === "ko" ? "ko-KR" : "vi-VN";

  const { data: applications } = await supabase
    .from("study_applications")
    .select(
      "id, status, next_action, next_deadline, target_department_label, created_at"
    )
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {tr(locale, "대학 선택", "Chọn trường")}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {tr(
              locale,
              "학생이 지원할 대학·학과·학기를 선택합니다.",
              "Chọn trường·ngành·học kỳ sinh viên sẽ đăng ký."
            )}
          </p>
        </div>
        <Link
          href={`/center/students/${id}/applications/new`}
          className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {tr(locale, "+ 지원 추가", "+ Thêm đơn")}
        </Link>
      </header>

      {!applications || applications.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          {tr(
            locale,
            "등록된 지원이 없습니다.",
            "Chưa có đơn nào."
          )}
          <br />
          {tr(
            locale,
            '"+ 지원 추가"를 눌러 모집 중인 대학·학과를 선택하세요.',
            'Nhấn "+ Thêm đơn" để chọn trường·ngành đang tuyển.'
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {applications.map((app) => (
            <li key={app.id} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">
                    {app.target_department_label ?? "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {app.next_deadline
                      ? tr(
                          locale,
                          `마감 ${new Date(app.next_deadline).toLocaleDateString(dateLocale)}`,
                          `Hạn ${new Date(app.next_deadline).toLocaleDateString(dateLocale)}`
                        )
                      : tr(locale, "마감일 없음", "Chưa có hạn")}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <StatusSelect
                    locale={locale}
                    applicationId={app.id}
                    studentId={id}
                    current={app.status}
                  />
                  <Link
                    href={`/center/students/${id}/applications/${app.id}/edit`}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {tr(locale, "수정", "Sửa")}
                  </Link>
                  <DeleteApplicationButton
                    locale={locale}
                    applicationId={app.id}
                    studentId={id}
                    departmentLabel={app.target_department_label}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
