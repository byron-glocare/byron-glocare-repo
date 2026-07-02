/**
 * /center/students/[id] — 개요(모아보기) 탭.
 *   학생의 기본 정보 / 대학 정보 / 상세 정보(완성도) / 서류 를 한눈에.
 *   각 섹션의 버튼으로 해당 탭으로 이동. 정보/서류가 없으면 "없음"으로 표시.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { residenceFromStudentLocation } from "@/lib/admission/offering-languages";
import { getLocale, tr, type Locale } from "@/lib/i18n";

import { updateApplicationStatusAction } from "./applications/actions";
import { StatusSelect } from "./applications/status-select";
import { DeleteApplicationButton } from "./applications/delete-application-button";
import { DocsCompletePopup } from "./docs-complete-popup";

/** 모집요강 schedule 에서 다가오는(오늘 이후) 일정 항목 추출 */
function upcomingSchedule(
  schedule: unknown,
  locale: Locale,
  dateLocale: string
): Array<{ label: string; date: string }> {
  const rounds =
    schedule && typeof schedule === "object"
      ? ((schedule as { rounds?: unknown[] }).rounds ?? [])
      : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Array<{ label: string; date: string; t: number }> = [];
  const push = (label: string, v: unknown) => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return;
    const d = new Date(`${v.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime()) || d.getTime() < today.getTime()) return;
    out.push({ label, date: d.toLocaleDateString(dateLocale), t: d.getTime() });
  };
  for (const r of rounds as Array<Record<string, unknown>>) {
    push(tr(locale, "원서 마감", "Hạn nộp đơn"), r.application_close);
    push(tr(locale, "서류 마감", "Hạn nộp hồ sơ"), r.document_submission_close);
    push(tr(locale, "면접", "Phỏng vấn"), r.interview);
    push(tr(locale, "합격 발표", "Công bố KQ"), r.result_announcement);
  }
  return out.sort((a, b) => a.t - b.t).slice(0, 3);
}

function visaLabel(locale: Locale, visa: string): string {
  switch (visa) {
    case "D-4":
      return tr(locale, "D-4 (어학연수)", "D-4 (Khóa tiếng)");
    case "D-2":
      return tr(locale, "D-2 (정규유학)", "D-2 (Du học)");
    case "none":
      return tr(locale, "없음", "Không có");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return visa;
  }
}

function locationLabel(locale: Locale, loc: string): string {
  switch (loc) {
    case "VN":
      return tr(locale, "베트남", "Việt Nam");
    case "KR":
      return tr(locale, "한국", "Hàn Quốc");
    case "other":
      return tr(locale, "기타", "Khác");
    default:
      return loc;
  }
}

export default async function StudentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();
  const dateLocale = locale === "ko" ? "ko-KR" : "vi-VN";
  const base = `/center/students/${id}`;

  const { data: student, error: stErr } = await supabase
    .from("study_managed_students")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (stErr || !student) notFound();

  const residence = residenceFromStudentLocation(student.location);

  const { data: apps } = await supabase
    .from("study_applications")
    .select(
      "id, status, next_deadline, target_department_label, target_department_id, admission_spec_id, offering_id, selected_language, created_at"
    )
    .eq("student_id", id)
    .order("created_at", { ascending: false });
  const applications = apps ?? [];

  // 부속 데이터 (지원 있을 때만)
  const specIds = Array.from(new Set(applications.map((a) => a.admission_spec_id)));
  const [{ data: specs }, { data: vals }] = await Promise.all([
    specIds.length > 0
      ? supabase
          .from("study_admission_specs")
          .select("id, university_id, term, schedule, is_online_submission")
          .in("id", specIds)
      : Promise.resolve({ data: [] as Array<{ id: string; university_id: number; term: string; schedule: unknown; is_online_submission: boolean | null }> }),
    supabase
      .from("study_student_data_values")
      .select("data_type_key")
      .eq("student_id", id),
  ]);
  const specMap = new Map((specs ?? []).map((s) => [s.id, s]));
  const filledKeys = new Set((vals ?? []).map((v) => v.data_type_key));

  const uniIds = Array.from(
    new Set((specs ?? []).map((s) => s.university_id))
  );
  const [{ data: unis }, { data: formFiles }, { data: subs }] =
    await Promise.all([
      uniIds.length > 0
        ? supabase
            .from("universities")
            .select("id, name_ko, name_vi")
            .in("id", uniIds)
        : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> }),
      uniIds.length > 0
        ? supabase
            .from("study_admission_form_files")
            .select("id, university_id, department_name, name_ko, required_data_type_keys, is_essay, essay_sections")
            .in("university_id", uniIds)
            .eq("is_current", true)
        : Promise.resolve({ data: [] as Array<{ id: string; university_id: number; department_name: string | null; name_ko: string; required_data_type_keys: string[] | null; is_essay: boolean | null; essay_sections: unknown }> }),
      uniIds.length > 0
        ? supabase
            .from("study_required_submissions")
            .select("id, university_id, department_id, name_ko, applies_to_languages, applies_to_locations")
            .eq("is_active", true)
            .eq("status", "approved")
        : Promise.resolve({ data: [] as Array<{ id: string; university_id: number | null; department_id: number | null; name_ko: string; applies_to_languages: string[]; applies_to_locations: string[] }> }),
    ]);
  const uniMap = new Map((unis ?? []).map((u) => [u.id, u]));
  const uniName = (uniId: number) => {
    const u = uniMap.get(uniId);
    return (
      (locale === "ko" ? u?.name_ko : u?.name_vi) ?? u?.name_ko ?? `#${uniId}`
    );
  };

  // 작성서류(form files) — 지원 대학/학과에 해당하는 현행 양식
  const applicableForms = (formFiles ?? []).filter((f) => {
    return applications.some((a) => {
      const uni = specMap.get(a.admission_spec_id)?.university_id;
      if (f.university_id !== uni) return false;
      if (f.department_name == null) return true;
      return a.target_department_label === f.department_name;
    });
  });
  // 제출서류 — 공용 + 지원 대학, 거주지·언어 분기
  const applicableSubs = (subs ?? []).filter((s) => {
    return applications.some((a) => {
      const uni = specMap.get(a.admission_spec_id)?.university_id ?? null;
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
  });

  // 추가 도구 노출 판정 — 새 5탭에 없는 기능을 관련 있을 때만 안내
  //   · 온라인 접수 대학이 있으면 접수 가이드(/forms)
  //   · 서술형 문항이 있으면 AI 자기소개서(/essays)
  const hasOnlineSubmission = applications.some(
    (a) => specMap.get(a.admission_spec_id)?.is_online_submission === true
  );
  // (구 essay_questions 폐기 — is_essay + essay_sections 기준)
  const hasEssayQuestions = applicableForms.some(
    (f) =>
      f.is_essay === true &&
      Array.isArray(f.essay_sections) &&
      f.essay_sections.length > 0
  );

  // 상세정보 완성도 = 필요 데이터 키 중 채워진 비율
  const requiredKeys = new Set<string>();
  for (const f of applicableForms)
    for (const k of f.required_data_type_keys ?? []) requiredKeys.add(k);
  const requiredTotal = requiredKeys.size;
  const requiredFilled = Array.from(requiredKeys).filter((k) =>
    filledKeys.has(k)
  ).length;

  // 서류 준비 상태: 작성서류는 필요데이터 충족 시 '준비됨', 제출서류는 발급 필요
  const formReady = (f: (typeof applicableForms)[number]) =>
    (f.required_data_type_keys ?? []).every((k) => filledKeys.has(k));
  const readyForms = applicableForms.filter(formReady);
  const notReadyForms = applicableForms.filter((f) => !formReady(f));

  // 모든 작성서류 준비됨 + 지원 1건 + 단계가 작성완료 이전 → '서류 작성 완료' 제안
  const singleApp = applications.length === 1 ? applications[0] : null;
  const allFormsReady =
    applicableForms.length > 0 && notReadyForms.length === 0;
  const suggestDocsComplete =
    singleApp != null &&
    allFormsReady &&
    (singleApp.status === "payment_pending" ||
      singleApp.status === "preparing");

  return (
    <div className="space-y-5">
      {/* 서류 완비 시 1회 팝업으로 단계 변경 제안 */}
      {suggestDocsComplete && singleApp ? (
        <DocsCompletePopup
          locale={locale}
          applicationId={singleApp.id}
          studentId={id}
        />
      ) : null}

      {/* 서류 작성 완료 제안 배너 (수동 변경용) */}
      {suggestDocsComplete && singleApp ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm text-sky-800">
            {tr(
              locale,
              "작성서류가 모두 준비되었습니다. 단계를 '서류 작성 완료'로 변경할까요?",
              "Hồ sơ đã sẵn sàng. Đổi giai đoạn sang 'Hoàn tất hồ sơ'?"
            )}
          </p>
          <form
            action={updateApplicationStatusAction.bind(
              null,
              singleApp.id,
              id
            )}
          >
            <input type="hidden" name="status" value="docs_complete" />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              {tr(locale, "서류 작성 완료로 변경", "Đổi sang Hoàn tất")}
            </button>
          </form>
        </div>
      ) : null}

      {/* 1. 기본 정보 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {tr(locale, "기본 정보", "Thông tin cơ bản")}
          </h2>
          <Link
            href={`${base}/edit`}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "편집", "Sửa")}
          </Link>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label={tr(locale, "생년월일", "Ngày sinh")} value={student.dob} />
          <Field label={tr(locale, "전화번호", "SĐT")} value={student.phone} />
          <Field label="Email" value={student.email} />
          <Field
            label="TOPIK"
            value={
              student.topik_level
                ? tr(locale, `${student.topik_level}급`, `Cấp ${student.topik_level}`)
                : null
            }
          />
          <Field
            label={tr(locale, "현재 비자", "Visa")}
            value={student.current_visa ? visaLabel(locale, student.current_visa) : null}
          />
          <Field
            label={tr(locale, "현재 거주지", "Nơi cư trú")}
            value={student.location ? locationLabel(locale, student.location) : null}
          />
        </dl>
      </section>

      {/* 2. 대학 정보 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {tr(locale, "대학 정보", "Thông tin trường")}
          </h2>
          <Link
            href={`${base}/select`}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "대학 선택 →", "Chọn trường →")}
          </Link>
        </div>
        {applications.length === 0 ? (
          <EmptyNote
            text={tr(
              locale,
              "선택한 대학이 없습니다. '대학 선택'에서 모집 중인 대학·학과를 고르세요.",
              "Chưa chọn trường. Chọn ở 'Chọn trường'."
            )}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {applications.map((a) => {
              const spec = specMap.get(a.admission_spec_id);
              const upcoming = upcomingSchedule(
                spec?.schedule,
                locale,
                dateLocale
              );
              return (
                <li key={a.id} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">
                        {a.target_department_label ?? "—"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {spec ? uniName(spec.university_id) : "—"}
                        {spec?.term ? ` · ${spec.term}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {tr(locale, "다가오는 일정", "Lịch sắp tới")}:{" "}
                        {a.next_deadline ? (
                          <span className="mr-2 text-slate-700">
                            {tr(locale, "마감 ", "Hạn ")}
                            {new Date(a.next_deadline).toLocaleDateString(dateLocale)}
                          </span>
                        ) : null}
                        {upcoming.length > 0 ? (
                          <span className="text-slate-600">
                            {upcoming
                              .map((u) => `${u.label} ${u.date}`)
                              .join(" · ")}
                          </span>
                        ) : !a.next_deadline ? (
                          <span className="text-slate-400">
                            {tr(locale, "없음", "Không có")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <StatusSelect
                        locale={locale}
                        applicationId={a.id}
                        studentId={id}
                        current={a.status}
                      />
                      <Link
                        href={`/center/admissions/${a.admission_spec_id}`}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        {tr(locale, "모집요강", "Hồ sơ TS")}
                      </Link>
                      <DeleteApplicationButton
                        locale={locale}
                        applicationId={a.id}
                        studentId={id}
                        departmentLabel={a.target_department_label}
                        giveUp
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. 상세 정보 (완성도) */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {tr(locale, "상세 정보", "Thông tin chi tiết")}
          </h2>
          <Link
            href={`${base}/data`}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "입력 →", "Nhập →")}
          </Link>
        </div>
        {requiredTotal === 0 ? (
          <EmptyNote
            text={
              applications.length === 0
                ? tr(
                    locale,
                    "대학을 먼저 선택하면 필요한 정보 항목이 표시됩니다.",
                    "Chọn trường để biết các thông tin cần nhập."
                  )
                : tr(
                    locale,
                    "이 대학에 필요한 입력 항목이 없습니다.",
                    "Không có mục cần nhập cho trường này."
                  )
            }
          />
        ) : (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {tr(locale, "완성도", "Hoàn thành")}
              </span>
              <span className="font-semibold text-slate-900">
                {requiredFilled} / {requiredTotal}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${requiredTotal ? Math.round((requiredFilled / requiredTotal) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* 4. 서류 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {tr(locale, "서류", "Hồ sơ")}
          </h2>
          <Link
            href={`${base}/final`}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr(locale, "작성하기 →", "Soạn →")}
          </Link>
        </div>
        {applicableForms.length === 0 && applicableSubs.length === 0 ? (
          <EmptyNote
            text={
              applications.length === 0
                ? tr(
                    locale,
                    "대학을 먼저 선택하면 준비할 서류가 표시됩니다.",
                    "Chọn trường để biết giấy tờ cần chuẩn bị."
                  )
                : tr(
                    locale,
                    "이 대학에 등록된 서류가 없습니다.",
                    "Chưa có giấy tờ cho trường này."
                  )
            }
          />
        ) : (
          <div className="space-y-4">
            {/* 준비됨 */}
            <DocGroup
              title={tr(locale, "준비됨", "Sẵn sàng")}
              tone="ready"
              empty={tr(locale, "준비된 서류 없음", "Chưa có")}
              items={readyForms.map((f) => f.name_ko)}
            />
            {/* 미완료 */}
            <DocGroup
              title={tr(locale, "미완료", "Chưa xong")}
              tone="todo"
              empty={tr(locale, "없음", "Không có")}
              items={[
                ...notReadyForms.map(
                  (f) =>
                    `${f.name_ko} (${tr(locale, "정보 부족", "thiếu thông tin")})`
                ),
                ...applicableSubs.map(
                  (s) =>
                    `${s.name_ko} (${tr(locale, "발급 필요", "cần xin cấp")})`
                ),
              ]}
            />
          </div>
        )}
      </section>

      {/* 5. 추가 도구 — 새 탭에 없는 기능을 관련 있을 때만 안내 */}
      {hasOnlineSubmission || hasEssayQuestions ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-1 text-base font-semibold text-slate-900">
            {tr(locale, "추가 도구", "Công cụ khác")}
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            {tr(
              locale,
              "이 학생에게 해당하는 경우에만 표시됩니다.",
              "Chỉ hiển thị khi áp dụng cho sinh viên này."
            )}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {hasOnlineSubmission ? (
              <Link
                href={`${base}/forms`}
                className="flex-1 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 hover:bg-sky-100"
              >
                <div className="text-sm font-semibold text-sky-900">
                  🔗 {tr(locale, "온라인 접수 안내", "Hướng dẫn nộp trực tuyến")}
                </div>
                <div className="mt-0.5 text-xs text-sky-700">
                  {tr(
                    locale,
                    "온라인으로 접수하는 대학의 가이드·접수폼·제출서류를 확인합니다.",
                    "Hướng dẫn, biểu mẫu, giấy tờ cho trường nộp trực tuyến."
                  )}
                </div>
              </Link>
            ) : null}
            {hasEssayQuestions ? (
              <Link
                href={`${base}/essays`}
                className="flex-1 rounded-md border border-violet-200 bg-violet-50 px-4 py-3 hover:bg-violet-100"
              >
                <div className="text-sm font-semibold text-violet-900">
                  ✍️ {tr(locale, "AI 자기소개서", "Bài luận AI")}
                </div>
                <div className="mt-0.5 text-xs text-violet-700">
                  {tr(
                    locale,
                    "양식의 서술형 문항 답변을 학생 정보 기반으로 작성합니다.",
                    "Soạn câu trả lời tự luận dựa trên thông tin sinh viên."
                  )}
                </div>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function DocGroup({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: "ready" | "todo";
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className={`size-2 rounded-full ${tone === "ready" ? "bg-emerald-500" : "bg-amber-400"}`}
        />
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <span className="text-xs text-slate-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="pl-3.5 text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-1 pl-3.5">
          {items.map((it, i) => (
            <li key={i} className="text-sm text-slate-700">
              · {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
