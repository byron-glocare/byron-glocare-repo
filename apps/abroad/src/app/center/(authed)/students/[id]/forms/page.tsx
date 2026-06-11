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
import { residenceFromStudentLocation } from "@/lib/admission/offering-languages";
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

function submissionTargetLabel(
  locale: Locale,
  target: string,
  note: string | null
): string {
  switch (target) {
    case "self":
      return tr(locale, "본인", "Bản thân");
    case "father":
      return tr(locale, "아버지", "Cha");
    case "mother":
      return tr(locale, "어머니", "Mẹ");
    case "other":
      return note || tr(locale, "기타", "Khác");
    default:
      return target;
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
    .select("id, name, location")
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  // 학생 거주지(국내/해외) — 서류 분기용. location 속성 그대로 사용.
  const studentResidence = residenceFromStudentLocation(student.location);

  // application + spec + university + applicable forms
  const { data: apps } = await supabase
    .from("study_applications")
    .select(
      "id, admission_spec_id, target_department_label, selected_language"
    )
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

  type SubmissionItem = {
    id: string;
    name_ko: string;
    name_vi: string | null;
    target_person: string | null;
    target_person_note: string | null;
    sample_image_url: string | null;
    lead_time_days?: number;
    needs_notarization?: boolean;
    needs_translation?: boolean;
    issuer?: string;
    notes?: string;
  };
  type OnlineDest = {
    university_id: number;
    university_name_ko: string;
    guide_url: string | null;
    form_url: string | null;
    department_labels: string[];
    submissions: SubmissionItem[];
  };
  const onlineDestinations: OnlineDest[] = [];

  if ((apps ?? []).length > 0) {
    const specIds = (apps ?? []).map((a) => a.admission_spec_id);
    const { data: specs } = await supabase
      .from("study_admission_specs")
      .select(
        "id, university_id, is_online_submission, online_guide_url, online_form_url"
      )
      .in("id", specIds);

    const specToUni = new Map(
      (specs ?? []).map((s) => [s.id, s.university_id])
    );
    const universityIds = Array.from(
      new Set((specs ?? []).map((s) => s.university_id))
    );
    // 온라인 접수 대학 + 가이드/접수폼
    const onlineUni = new Map<
      number,
      { guide_url: string | null; form_url: string | null }
    >();
    for (const s of specs ?? []) {
      if (s.is_online_submission) {
        onlineUni.set(s.university_id, {
          guide_url: s.online_guide_url,
          form_url: s.online_form_url,
        });
      }
    }

    if (universityIds.length > 0) {
      const [{ data: unis }, { data: formRows }, { data: subRows }] =
        await Promise.all([
          supabase.from("universities").select("id, name_ko").in("id", universityIds),
          supabase
            .from("study_admission_form_files")
            .select(
              "id, university_id, department_name, name_ko, key, required_data_type_keys, essay_questions"
            )
            .in("university_id", universityIds)
            .eq("is_current", true),
          // 제출서류 (공용 + 지원 대학), 승인·활성만
          supabase
            .from("study_required_submissions")
            .select("*")
            .eq("is_active", true)
            .eq("status", "approved"),
        ]);

      const uniName = new Map((unis ?? []).map((u) => [u.id, u.name_ko]));
      const allLabel = tr(locale, "(전체)", "(Toàn trường)");

      // 제출서류: 공용 마스터(+대학 오버라이드) + 대학 전용
      const allSubs = subRows ?? [];
      const subItem = (r: (typeof allSubs)[number]): SubmissionItem => {
        const iss = r.issuance_requirements ?? {};
        return {
          id: r.id,
          name_ko: r.name_ko,
          name_vi: r.name_vi,
          target_person: r.target_person,
          target_person_note: r.target_person_note,
          sample_image_url: r.sample_image_url,
          lead_time_days: iss.lead_time_days,
          needs_notarization: iss.needs_notarization,
          needs_translation: iss.needs_translation,
          issuer: iss.issuer,
          notes: iss.notes,
        };
      };
      // 언어/거주지 분기: 태그 있으면 학생 선택값이 그 안에 있어야 적용
      const appliesToSel = (
        s: (typeof allSubs)[number],
        selLang: string | null,
        selLoc: string | null
      ): boolean => {
        const langs = (s.applies_to_languages ?? []) as string[];
        const locs = (s.applies_to_locations ?? []) as string[];
        const langOk =
          langs.length === 0 || (selLang != null && langs.includes(selLang));
        const locOk =
          locs.length === 0 || (selLoc != null && locs.includes(selLoc));
        return langOk && locOk;
      };
      const submissionsFor = (
        uniId: number,
        selLang: string | null,
        selLoc: string | null
      ): SubmissionItem[] => {
        const masters = allSubs.filter(
          (s) => s.university_id === null && !s.base_submission_id
        );
        const ovByBase = new Map(
          allSubs
            .filter((s) => s.university_id === uniId && s.base_submission_id)
            .map((s) => [s.base_submission_id, s])
        );
        const ownDept = allSubs.filter(
          (s) => s.university_id === uniId && !s.base_submission_id
        );
        return [
          ...masters.map((m) => ovByBase.get(m.id) ?? m),
          ...ownDept,
        ]
          .filter((s) => appliesToSel(s, selLang, selLoc))
          .map(subItem);
      };

      // 온라인 접수 대학별 목적지 구성
      for (const [uniId, info] of onlineUni.entries()) {
        const uniApps = (apps ?? []).filter(
          (a) => specToUni.get(a.admission_spec_id) === uniId
        );
        const labels = Array.from(
          new Set(uniApps.map((a) => a.target_department_label ?? allLabel))
        );
        // 언어=각 지원의 선택, 거주지=학생 location(국내/해외) → id 기준 합집합
        const subMap = new Map<string, SubmissionItem>();
        const appSel = uniApps.length > 0 ? uniApps : [null];
        for (const a of appSel) {
          for (const item of submissionsFor(
            uniId,
            a?.selected_language ?? null,
            studentResidence
          )) {
            if (!subMap.has(item.id)) subMap.set(item.id, item);
          }
        }
        onlineDestinations.push({
          university_id: uniId,
          university_name_ko: uniName.get(uniId) ?? "?",
          guide_url: info.guide_url,
          form_url: info.form_url,
          department_labels: labels,
          submissions: Array.from(subMap.values()),
        });
      }

      // 오프라인 대학 양식만 수집 (온라인 접수 대학은 양식 작성 제외)
      for (const app of apps ?? []) {
        const uniId = specToUni.get(app.admission_spec_id);
        if (uniId == null || onlineUni.has(uniId)) continue;
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

      {/* 온라인 접수 대학 — 양식 작성 대신 가이드 + 제출서류 */}
      {onlineDestinations.map((dest) => (
        <section
          key={dest.university_id}
          className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {dest.university_name_ko}
            </h2>
            <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">
              {tr(locale, "온라인 접수", "Nộp trực tuyến")}
            </span>
            {dest.department_labels.length > 0 ? (
              <span className="text-xs text-slate-500">
                {dest.department_labels.join(" · ")}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-600">
            {tr(
              locale,
              "이 대학은 온라인으로 접수합니다. 아래 가이드를 보고 학생 상세정보를 대학 접수 폼에 입력하세요.",
              "Trường này nộp hồ sơ trực tuyến. Xem hướng dẫn bên dưới và nhập thông tin sinh viên vào biểu mẫu của trường."
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            {dest.guide_url ? (
              <a
                href={dest.guide_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-sky-700 ring-1 ring-sky-300 hover:bg-sky-50"
              >
                📄 {tr(locale, "원서접수 가이드 열기", "Mở hướng dẫn nộp hồ sơ")}
              </a>
            ) : null}
            {dest.form_url ? (
              <a
                href={dest.form_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                🔗 {tr(locale, "온라인 접수 폼 열기", "Mở biểu mẫu nộp")}
              </a>
            ) : null}
            <a
              href={`/center/students/${id}/data`}
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              ✏️ {tr(locale, "학생 상세정보 보기/입력", "Xem/nhập thông tin SV")}
            </a>
          </div>

          {/* 제출서류 (캡쳐·발급해서 제출) */}
          <div>
            <h3 className="mb-1.5 text-sm font-semibold text-slate-800">
              {tr(locale, "제출 서류", "Hồ sơ cần nộp")} (
              {dest.submissions.length})
            </h3>
            {dest.submissions.length === 0 ? (
              <p className="text-xs text-slate-500">
                {tr(
                  locale,
                  "등록된 제출서류가 없습니다.",
                  "Chưa có hồ sơ cần nộp."
                )}
              </p>
            ) : (
              <ul className="divide-y divide-sky-100 rounded-md border border-sky-100 bg-white">
                {dest.submissions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 px-3 py-2.5 text-sm"
                  >
                    {s.sample_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        href={s.sample_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                      >
                        <img
                          src={s.sample_image_url}
                          alt={s.name_ko}
                          className="size-12 rounded border object-cover"
                        />
                      </a>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-900">
                          {locale === "ko" ? s.name_ko : s.name_vi || s.name_ko}
                        </span>
                        {s.target_person ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {submissionTargetLabel(
                              locale,
                              s.target_person,
                              s.target_person_note
                            )}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                        {s.issuer ? (
                          <span>
                            {tr(locale, "발급처", "Nơi cấp")}: {s.issuer}
                          </span>
                        ) : null}
                        {s.lead_time_days != null ? (
                          <span>
                            {tr(locale, "발급 소요", "Thời gian cấp")}:{" "}
                            {s.lead_time_days}
                            {tr(locale, "일", " ngày")}
                          </span>
                        ) : null}
                        {s.needs_notarization ? (
                          <span>{tr(locale, "공증 필요", "Cần công chứng")}</span>
                        ) : null}
                        {s.needs_translation ? (
                          <span>{tr(locale, "번역 필요", "Cần dịch thuật")}</span>
                        ) : null}
                      </div>
                      {s.notes ? (
                        <div className="mt-0.5 text-xs text-slate-500">
                          {s.notes}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}

      {forms.length === 0 ? (
        onlineDestinations.length > 0 ? null : (
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
        )
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
