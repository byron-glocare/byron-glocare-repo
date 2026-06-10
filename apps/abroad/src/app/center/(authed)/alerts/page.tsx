/**
 * /center/alerts — 서류 준비 착수 얼럿 (6단계 리드타임 역산).
 *   직접제출 서류의 발급 소요기간을 마감에서 역산해, 지금 발급을 시작해야 하는
 *   (또는 이미 늦은) 학생/서류를 모아 보여준다. 대시보드 카운트의 상세.
 */

import Link from "next/link";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { computeLeadTimeFlags } from "@/lib/center/lead-time";
import { getLocale, tr, type Locale } from "@/lib/i18n";

function ddayLabel(locale: Locale, days: number): string {
  if (days < 0) return tr(locale, `마감 D+${-days} 지남`, `Quá hạn D+${-days}`);
  if (days === 0) return tr(locale, "오늘 마감", "Hết hạn hôm nay");
  return tr(locale, `마감 D-${days}`, `Còn D-${days}`);
}

export default async function CenterAlertsPage() {
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();
  const dateLocale = locale === "ko" ? "ko-KR" : "vi-VN";

  const flags = await computeLeadTimeFlags(supabase);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {tr(locale, "서류 준비 착수 얼럿", "Cảnh báo chuẩn bị hồ sơ")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "발급에 시간이 걸리는 제출서류를 마감에서 역산했습니다. 아래 학생은 지금 서류 발급을 시작해야 합니다.",
            "Tính ngược từ hạn chót cho các giấy tờ cần thời gian cấp. Những sinh viên dưới đây cần bắt đầu xin cấp giấy tờ ngay."
          )}
        </p>
      </header>

      {flags.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            {tr(
              locale,
              "지금 착수가 필요한 서류가 없습니다.",
              "Hiện không có giấy tờ nào cần bắt đầu ngay."
            )}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tr(
              locale,
              "지원의 마감일(다음 할 일 마감)과 직접제출 서류의 발급 소요기간으로 계산됩니다.",
              "Được tính từ hạn chót của đơn và thời gian cấp giấy tờ nộp trực tiếp."
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map((f) => {
            const overdue = f.daysUntilDeadline < 0;
            return (
              <div
                key={f.applicationId}
                className={`rounded-lg border bg-white p-4 ${
                  overdue ? "border-red-200" : "border-amber-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/center/students/${f.studentId}`}
                      className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {f.studentName}
                    </Link>
                    {f.universityNameKo ? (
                      <span className="text-sm text-slate-500">
                        {f.universityNameKo}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">
                      {new Date(`${f.deadline}T00:00:00`).toLocaleDateString(
                        dateLocale
                      )}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-medium ${
                        overdue
                          ? "bg-red-600 text-white"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {ddayLabel(locale, f.daysUntilDeadline)}
                    </span>
                  </div>
                </div>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {f.documents.map((d, i) => (
                    <li
                      key={`${d.nameKo}-${i}`}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                    >
                      <span className="font-medium text-slate-800">
                        {d.nameKo}
                      </span>
                      <span className="text-xs text-slate-500">
                        {tr(locale, "발급 ", "Cấp ")}
                        {d.leadTimeDays}
                        {tr(locale, "일 소요", " ngày")}
                      </span>
                      <span className="text-xs text-slate-400">
                        ·{" "}
                        {tr(locale, "착수 권장일 ", "Nên bắt đầu ")}
                        {new Date(
                          `${d.startBy}T00:00:00`
                        ).toLocaleDateString(dateLocale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
