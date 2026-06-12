/**
 * /center/students/[id]/documents — 서류 등록 탭.
 *   '제출해야 할 서류 = 학생이 올리는 파일'. 제출서류 목록의 각 항목에 업로드 슬롯.
 *   모집요강 기준 제출서류 + 개별 발급조건(글로케어가 3001에서 셋팅) 노출.
 *   (업로드 파일에서 정보입력 AI 자동 추출은 후속.)
 */

import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { residenceFromStudentLocation } from "@/lib/admission/offering-languages";
import { getLocale, tr, type Locale } from "@/lib/i18n";

import { SubmissionUploader } from "./submission-uploader";

function targetPersonLabel(locale: Locale, p: string | null): string | null {
  switch (p) {
    case "self":
      return tr(locale, "학생 본인", "Sinh viên");
    case "father":
      return tr(locale, "아버지", "Bố");
    case "mother":
      return tr(locale, "어머니", "Mẹ");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return null;
  }
}

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name, location")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();
  const residence = residenceFromStudentLocation(student.location);

  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, admission_spec_id, target_department_id, selected_language")
    .eq("student_id", id);
  const specIds = Array.from(
    new Set((apps ?? []).map((a) => a.admission_spec_id))
  );

  const [{ data: specs }, { data: subs }, { data: files }] = await Promise.all([
    specIds.length > 0
      ? supabase
          .from("study_admission_specs")
          .select("id, university_id")
          .in("id", specIds)
      : Promise.resolve({ data: [] as Array<{ id: string; university_id: number }> }),
    supabase
      .from("study_required_submissions")
      .select(
        "id, university_id, department_id, name_ko, name_vi, target_person, issuance_requirements, applies_to_languages, applies_to_locations"
      )
      .eq("is_active", true)
      .eq("status", "approved"),
    supabase
      .from("study_student_submission_files")
      .select("submission_id, file_name, file_path")
      .eq("student_id", id),
  ]);
  const specUni = new Map((specs ?? []).map((s) => [s.id, s.university_id]));
  const fileBySub = new Map(
    (files ?? []).map((f) => [
      f.submission_id,
      { file_name: f.file_name, file_path: f.file_path },
    ])
  );

  const seen = new Set<string>();
  const applicableSubs = (subs ?? []).filter((s) => {
    if (seen.has(s.id)) return false;
    const ok = (apps ?? []).some((a) => {
      const uni = specUni.get(a.admission_spec_id) ?? null;
      const uniMatch = s.university_id == null || s.university_id === uni;
      const deptMatch =
        s.department_id == null || s.department_id === a.target_department_id;
      const langs = (s.applies_to_languages ?? []) as string[];
      const locs = (s.applies_to_locations ?? []) as string[];
      const langOk =
        langs.length === 0 ||
        (a.selected_language != null && langs.includes(a.selected_language));
      const locOk = locs.length === 0 || locs.includes(residence);
      return uniMatch && deptMatch && langOk && locOk;
    });
    if (ok) seen.add(s.id);
    return ok;
  });

  const uploadedCount = applicableSubs.filter((s) =>
    fileBySub.has(s.id)
  ).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          {tr(locale, "서류 등록", "Tải giấy tờ")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "제출해야 할 서류를 업로드하세요. 가능한 것만 올려도 되고, 없이 다음 단계로 넘어갈 수 있습니다.",
            "Tải lên giấy tờ cần nộp. Chỉ cần những gì có; có thể bỏ qua để sang bước tiếp."
          )}
        </p>
      </header>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        {tr(
          locale,
          "💡 서류를 업로드하면, 다음 단계 '정보 입력'의 내용을 미리 채우는 데 활용됩니다.",
          "💡 Khi tải giấy tờ lên, dữ liệu sẽ được dùng để điền sẵn 'Nhập thông tin'."
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {tr(locale, "제출해야 할 서류", "Giấy tờ cần nộp")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {tr(
                locale,
                "선택한 대학·학과·거주지 기준입니다.",
                "Theo trường·ngành·nơi cư trú đã chọn."
              )}
            </p>
          </div>
          {applicableSubs.length > 0 ? (
            <span className="shrink-0 text-xs text-slate-500">
              {tr(locale, "업로드", "Đã tải")} {uploadedCount}/
              {applicableSubs.length}
            </span>
          ) : null}
        </div>

        {applicableSubs.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            {(apps ?? []).length === 0
              ? tr(
                  locale,
                  "대학을 먼저 선택하면 제출서류가 표시됩니다.",
                  "Chọn trường để xem giấy tờ cần nộp."
                )
              : tr(locale, "등록된 제출서류가 없습니다.", "Chưa có giấy tờ.")}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {applicableSubs.map((s) => {
              const iss = (s.issuance_requirements ?? {}) as {
                issuer?: string;
                validity_days?: number;
                lead_time_days?: number;
                needs_notarization?: boolean;
                needs_translation?: boolean;
                notes?: string;
              };
              const tp = targetPersonLabel(locale, s.target_person);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {s.name_ko}
                      </span>
                      {tp ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {tr(locale, "대상", "Đối tượng")}: {tp}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {iss.issuer ? (
                        <span>
                          {tr(locale, "발급처", "Nơi cấp")}: {iss.issuer}
                        </span>
                      ) : null}
                      {iss.lead_time_days != null ? (
                        <span>
                          {tr(locale, "발급 소요", "Cấp")} {iss.lead_time_days}
                          {tr(locale, "일", "n")}
                        </span>
                      ) : null}
                      {iss.validity_days != null ? (
                        <span>
                          {tr(locale, "유효", "HL")} {iss.validity_days}
                          {tr(locale, "일", "n")}
                        </span>
                      ) : null}
                      {iss.needs_notarization ? (
                        <span>{tr(locale, "공증", "Công chứng")}</span>
                      ) : null}
                      {iss.needs_translation ? (
                        <span>{tr(locale, "번역", "Dịch")}</span>
                      ) : null}
                    </div>
                    {iss.notes ? (
                      <p className="mt-1 text-xs text-slate-400">{iss.notes}</p>
                    ) : null}
                  </div>
                  <SubmissionUploader
                    locale={locale}
                    studentId={id}
                    submissionId={s.id}
                    existing={fileBySub.get(s.id) ?? null}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
