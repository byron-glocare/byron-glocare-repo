/**
 * /center/students/[id]/forms — 학생의 양식 목록 (B4-6).
 *
 * 학생의 application 들 → 적용 양식 (대학 전체 + 학과별) → 양식별 행.
 * 각 행 클릭 → /center/students/[id]/forms/[formFileId] 작성 시트.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import type { AdmissionFormFileKey } from "@/types/study";

function formKeyLabel(locale: Locale, key: AdmissionFormFileKey): string {
  switch (key) {
    case "application_form":
      return tr(locale, "입학 지원서", "Đơn đăng ký nhập học");
    case "self_intro":
      return tr(locale, "자기소개서", "Bản giới thiệu bản thân");
    case "study_plan":
      return tr(locale, "학업계획서", "Kế hoạch học tập");
    case "financial_pledge_form":
      return tr(locale, "재정보증서", "Cam kết tài chính");
    case "privacy_consent":
      return tr(locale, "개인정보 동의서", "Đồng ý bảo mật thông tin");
    case "academic_record_release":
      return tr(locale, "성적 제공 동의서", "Đồng ý cung cấp học bạ");
    case "recommendation_letter":
      return tr(locale, "추천서", "Thư giới thiệu");
    case "health_certificate":
      return tr(locale, "건강진단서 (양식)", "Giấy khám sức khỏe (mẫu)");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return key;
  }
}

export default async function StudentFormsListPage({
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
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  // application + spec + university + applicable forms
  const { data: apps } = await supabase
    .from("study_applications")
    .select("id, admission_spec_id, target_department_label")
    .eq("student_id", id);

  type FormEntry = {
    form_file_id: string;
    name_ko: string;
    department_name: string | null;
    university_name_ko: string;
    key: string;
    required_count: number;
    essay_count: number;
    application_labels: string[];
  };

  const collected = new Map<string, FormEntry>();

  if ((apps ?? []).length > 0) {
    const specIds = (apps ?? []).map((a) => a.admission_spec_id);
    const { data: specs } = await supabase
      .from("study_admission_specs")
      .select("id, university_id")
      .in("id", specIds);

    const specToUni = new Map(
      (specs ?? []).map((s) => [s.id, s.university_id])
    );
    const universityIds = Array.from(
      new Set((specs ?? []).map((s) => s.university_id))
    );

    if (universityIds.length > 0) {
      const [{ data: unis }, { data: formRows }] = await Promise.all([
        supabase
          .from("universities")
          .select("id, name_ko")
          .in("id", universityIds),
        supabase
          .from("study_admission_form_files")
          .select(
            "id, university_id, department_name, name_ko, key, required_data_type_keys, essay_questions"
          )
          .in("university_id", universityIds)
          .eq("is_current", true),
      ]);

      const uniName = new Map((unis ?? []).map((u) => [u.id, u.name_ko]));

      const allLabel = tr(locale, "(전체)", "(Toàn trường)");
      for (const app of apps ?? []) {
        const uniId = specToUni.get(app.admission_spec_id);
        if (uniId == null) continue;
        const applicable = (formRows ?? []).filter((f) => {
          if (f.university_id !== uniId) return false;
          if (f.department_name === null) return true;
          return (
            app.target_department_label &&
            f.department_name === app.target_department_label
          );
        });
        for (const f of applicable) {
          const existing = collected.get(f.id);
          const lbl = app.target_department_label ?? allLabel;
          if (existing) {
            if (!existing.application_labels.includes(lbl))
              existing.application_labels.push(lbl);
          } else {
            collected.set(f.id, {
              form_file_id: f.id,
              name_ko: f.name_ko,
              department_name: f.department_name,
              university_name_ko: uniName.get(f.university_id) ?? "?",
              key: f.key,
              required_count: (f.required_data_type_keys ?? []).length,
              essay_count: Array.isArray(f.essay_questions)
                ? f.essay_questions.length
                : 0,
              application_labels: [lbl],
            });
          }
        }
      }
    }
  }

  const forms = Array.from(collected.values());

  return (
    <div className="space-y-4">
      <header>
        <Link
          href={`/center/students/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← {student.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {tr(locale, "서류 작성", "Soạn hồ sơ")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(
            locale,
            "입학원서·자기소개서 등 모든 서류를 한곳에서 작성합니다. 각 서류를 눌러 작성하세요.",
            "Soạn tất cả hồ sơ (đơn nhập học, bài luận…) ở cùng một nơi. Nhấn vào từng hồ sơ để soạn."
          )}
        </p>
      </header>

      {forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base text-slate-600">
            {tr(
              locale,
              "적용되는 지원 양식이 없습니다.",
              "Không có mẫu hồ sơ nào áp dụng."
            )}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tr(
              locale,
              "학생에게 지원 내역이 있어야 하고, 대학이 양식을 시스템에 등록해야 합니다.",
              "Sinh viên cần có đơn tuyển sinh, và trường cần đăng tải mẫu hồ sơ trong hệ thống."
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "양식", "Mẫu")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "대학", "Trường")}
                </th>
                <th className="px-4 py-3 font-medium text-slate-700">
                  {tr(locale, "범위", "Phạm vi")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  {tr(locale, "데이터 항목", "Trường dữ liệu")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-700">
                  {tr(locale, "서술 문항", "Câu viết")}
                </th>
                <th className="w-32 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.form_file_id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/center/students/${id}/forms/${f.form_file_id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {f.name_ko}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {formKeyLabel(locale, f.key as AdmissionFormFileKey)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{f.university_name_ko}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {f.department_name ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                        {f.department_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        {tr(locale, "전체", "Toàn trường")}
                      </span>
                    )}
                    <div className="mt-1 text-slate-400">
                      {f.application_labels.join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{f.required_count}</td>
                  <td className="px-4 py-3 text-right">{f.essay_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/center/students/${id}/forms/${f.form_file_id}`}
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      {tr(locale, "작성 →", "Phiếu →")}
                    </Link>
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
