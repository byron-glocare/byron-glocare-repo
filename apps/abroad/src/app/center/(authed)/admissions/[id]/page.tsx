/**
 * /center/admissions/[id] — 모집요강 상세 (유학센터 read-only, 한/베 전환).
 *   approved 상태만 조회 가능 (RLS).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { downloadUrl } from "@/lib/storage-download";
import { getLocale, tr, type Locale } from "@/lib/i18n";
import {
  formatAgeRequirement,
  type AgeRequirementLike,
} from "@/lib/admission/age-requirement";
import {
  loadSpecDocuments,
  loadSpecTerms,
  type SpecDepartmentRow,
  type SpecIssuedDoc,
} from "@/lib/admission/spec-documents";

/** 라벨 맵에서 화면 언어에 맞는 쪽을 고른다. 없는 키는 원문 그대로. */
function L(
  map: Record<string, [string, string]>,
  key: string | null | undefined,
  locale: Locale
): string {
  const v = key ? map[key] : undefined;
  return v ? (locale === "ko" ? v[0] : v[1]) : (key ?? "—");
}

const DEPT_KIND_LABEL: Record<string, [string, string]> = {
  language: ["어학당", "Khóa tiếng"],
  regular: ["정규", "Chính quy"],
};

const NOTARIZATION_LABEL: Record<string, [string, string]> = {
  none: ["불필요", "Không cần"],
  translation_notarization: ["번역공증", "Công chứng dịch"],
  consul: ["영사확인", "Hợp pháp hóa lãnh sự"],
  consul_for_vietnam: ["주베트남 영사확인", "Hợp pháp hóa lãnh sự Việt Nam"],
  apostille: ["아포스티유", "Apostille"],
  apostille_or_consul: ["아포스티유 또는 영사확인", "Apostille hoặc HPHLS"],
};

const EDUCATION_LABEL: Record<string, [string, string]> = {
  high_school: ["고등학교 졸업", "Tốt nghiệp THPT"],
  high_school_12yrs: ["정규 12년 교육과정", "12 năm giáo dục chính quy"],
  health_related_bachelor: ["보건계열 학사", "Cử nhân ngành y tế"],
  bachelor: ["학사", "Cử nhân"],
  master: ["석사", "Thạc sĩ"],
};

const HOLDER_LABEL: Record<string, [string, string]> = {
  self: ["본인", "Bản thân"],
  parent: ["부모", "Cha mẹ"],
  guardian: ["법정대리인", "Người giám hộ"],
  financial_sponsor: ["재정보증인", "Người bảo lãnh tài chính"],
};

const ALT_PATH_LABEL: Record<string, [string, string]> = {
  sejong_institute: ["세종학당", "Học viện Sejong"],
  kiip: ["사회통합프로그램(KIIP)", "Chương trình KIIP"],
  university_internal_test: ["대학 자체 한국어 시험", "Kỳ thi tiếng Hàn nội bộ"],
  korean_education_center: ["한국교육원", "Trung tâm giáo dục Hàn Quốc"],
  health_science_degree: ["보건계열 학위", "Bằng y tế"],
  elder_care_career: ["요양보호 경력", "Kinh nghiệm chăm sóc"],
};

const BENEFIT_LABEL: Record<string, [string, string]> = {
  relaxed_visa_financial: ["비자 재정요건 완화", "Giảm yêu cầu tài chính visa"],
  relaxed_stay_extension: ["체류 연장 우대", "Gia hạn cư trú dễ dàng"],
  e7_eligible_after_graduation: ["졸업 후 E-7 가능", "Đủ điều kiện E-7 sau tốt nghiệp"],
  min_wage_guaranteed: ["최저임금 보장", "Đảm bảo lương tối thiểu"],
  job_placement: ["취업 연계", "Hỗ trợ việc làm"],
  other: ["기타", "Khác"],
};

const APPLIES_TO_LABEL: Record<string, [string, string]> = {
  freshman: ["신입생", "Tân sinh viên"],
  enrolled: ["재학생", "Sinh viên đang học"],
  both: ["모두", "Cả hai"],
};

const STATUS_LABEL: Record<string, [string, string]> = {
  approved: ["승인됨", "Đã duyệt"],
};

const FORM_KEY_LABEL: Record<string, [string, string]> = {
  application_form: ["입학지원서", "Đơn đăng ký nhập học"],
  self_intro: ["자기소개서", "Bản giới thiệu bản thân"],
  study_plan: ["학업계획서", "Kế hoạch học tập"],
  financial_pledge_form: ["재정보증서", "Cam kết tài chính"],
  privacy_consent: ["개인정보 동의서", "Đồng ý bảo mật thông tin"],
  academic_record_release: ["성적 제공 동의서", "Đồng ý cung cấp học bạ"],
  recommendation_letter: ["추천서", "Thư giới thiệu"],
  health_certificate: ["건강진단서(양식)", "Giấy khám sức khỏe (mẫu)"],
  other: ["기타", "Khác"],
};

type Scholarship = {
  name?: string;
  applies_to?: string;
  condition?: string;
  benefit_type?: string;
  benefit_value?: number | string | null;
  tiered_by_topik?: Record<string, number | string> | null;
  notes?: string | null;
};

type Round = {
  name?: string;
  application_open?: string | null;
  application_close?: string | null;
  document_submission_close?: string | null;
  interview_period?: [string, string];
  interview?: string | null;
  result_announcement?: string | null;
  payment_period?: [string, string];
};

export default async function CenterAdmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyCenterSession();
  const locale = await getLocale();
  const { id } = await params;
  const supabase = await createCenterClient();

  const { data: spec, error } = await supabase
    .from("study_admission_specs")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (error || !spec) notFound();

  const { data: university } = await supabase
    .from("universities")
    .select("id, name_ko, name_vi, region_ko")
    .eq("id", spec.university_id)
    .maybeSingle();

  const scholarships = (Array.isArray(spec.scholarships) ? spec.scholarships : []) as Scholarship[];

  // 0067: 학과(어학당 먼저) + 학과별 발급서류·작성서류 양식, 학기별 일정
  const [{ departments, byDept }, termsBySpec] = await Promise.all([
    loadSpecDocuments(supabase, spec),
    loadSpecTerms(supabase, [spec.id]),
  ]);
  const specTerms = termsBySpec.get(spec.id) ?? [];

  type ScheduleShape = {
    rounds?: Round[];
    semester_start?: string | null;
    semester_end?: string | null;
    submission_method?: string;
  };
  // 학기별 일정. 학기 행이 없으면 요강 공통 schedule(옛 데이터) 하나로.
  const termSchedules: Array<{ term: string; schedule: ScheduleShape; notes: string | null }> =
    specTerms.length > 0
      ? specTerms.map((t) => ({
          term: t.term,
          schedule: (t.schedule && typeof t.schedule === "object" ? t.schedule : {}) as ScheduleShape,
          notes: t.notes,
        }))
      : [{ term: spec.term, schedule: (spec.schedule ?? {}) as ScheduleShape, notes: null }];
  const termLabel = specTerms.length > 0 ? specTerms.map((t) => t.term).join(" · ") : spec.term;

  const deptName = (d: SpecDepartmentRow) =>
    locale === "ko" ? d.name_ko : d.name_vi || d.name_ko;
  const docName = (doc: SpecIssuedDoc) =>
    locale === "ko" ? doc.name_ko : doc.name_vi || doc.name_ko;
  const docNotes = (doc: SpecIssuedDoc) =>
    locale === "ko" ? doc.notes : doc.notes_vi ?? doc.notes;
  const docCount = departments.reduce((n, d) => n + (byDept.get(d.id)?.issued.length ?? 0), 0);

  const tuition = (spec.tuition ?? {}) as {
    unit?: string;
    currency?: string;
    application_fee?: number | null;
    admission_fee?: number | null;
    tuition_per_semester?: number | null;
    tuition_per_year?: number | null;
    dorm_fee?: number | null;
    insurance_per_year?: number | null;
    tuition_by_faculty?: Record<string, number>;
    payment_method?: string;
  };

  const eligibility = (spec.eligibility ?? {}) as {
    applicant_categories?: string[];
    age_requirement?: AgeRequirementLike | null;
    education_required?: string;
    education_paths?: string[];
    education_exclusions?: string[];
    gpa_min?: number | null;
    gpa_scale?: string | null;
    korean_proficiency?: {
      topik_min_default?: number | null;
      alternative_paths?: Array<{
        type?: string;
        level?: string;
        description?: string;
      }>;
      post_admission_requirement?: string | null;
    };
    english_proficiency?: {
      applies_to_departments?: string[];
      minimums?: Record<string, number | string>;
      notes?: string;
    };
    financial_minimum?: {
      amount?: number | null;
      currency?: string;
      holder_relations?: string[];
      freshness_days?: number | null;
      notes?: string | null;
    } | null;
    exclusions?: string[];
    notes_ko?: string;
  };

  const metadata = (spec.metadata ?? {}) as {
    selection_process?: {
      method?: string;
      interview_required?: boolean;
      interview_content?: string[];
      evaluation_criteria?: string;
    };
    post_acceptance?: {
      visa_type?: string;
      post_graduation_visa?: string;
      insurance_requirement?: string;
      warnings?: string[];
      process_steps?: string[];
    };
    contacts?: {
      phone?: string;
      phone_vietnamese?: string;
      email?: string | null;
      address_ko?: string;
      website?: string;
      online_apply_url?: string;
      department_name?: string;
    };
    government_designations?: Array<{
      designation_name?: string;
      benefits?: string[];
    }>;
    country_specific_notes_vi?: string;
    language_program?: {
      hours_per_semester?: number;
      hours_per_week?: number;
      weeks_per_semester?: number;
      visa_type?: string;
    };
  };

  const fmtCur = (n: number | null | undefined, currency?: string) => {
    if (n == null) return "—";
    return `${n.toLocaleString(locale === "ko" ? "ko-KR" : "vi-VN")} ${currency ?? "KRW"}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/center/admissions"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← {tr(locale, "목록으로", "Quay lại danh sách")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {university?.name_ko ?? "?"}
          </h1>
          {university?.name_vi ? (
            <p className="mt-0.5 text-sm text-slate-600">{university.name_vi}</p>
          ) : null}
          <p className="mt-1 text-sm text-slate-500">
            {termLabel}
            {university?.region_ko ? ` · ${university.region_ko}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          {L(STATUS_LABEL, spec.status, locale)}
        </span>
      </div>

      {/* Học khoa — 어학당 먼저 */}
      <Card title={`${tr(locale, "학과", "Ngành học")} (${departments.length})`}>
        {departments.length === 0 ? (
          <p className="text-sm text-slate-500">{tr(locale, "데이터 없음", "Không có dữ liệu")}</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">{tr(locale, "구분", "Loại")}</th>
                  <th className="px-3 py-2 font-medium">{tr(locale, "학부", "Khoa")}</th>
                  <th className="px-3 py-2 font-medium">{tr(locale, "학과", "Ngành")}</th>
                  <th className="px-3 py-2 font-medium">{tr(locale, "과정", "Hệ")}</th>
                  <th className="w-16 px-3 py-2 text-center font-medium">{tr(locale, "연한", "Năm")}</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">{tr(locale, "모집인원", "Chỉ tiêu")}</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">TOPIK</th>
                  <th className="w-36 px-3 py-2 text-right font-medium">{tr(locale, "학기 등록금", "Học phí/kỳ")}</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="rounded border border-slate-300 px-1.5 py-0.5 text-xs">
                        {L(DEPT_KIND_LABEL, d.kind, locale)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{d.info.faculty ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{deptName(d)}</td>
                    <td className="px-3 py-2 text-slate-600">{d.info.track ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{d.info.years ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{d.info.capacity ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {d.info.korean_min_topik ? `${d.info.korean_min_topik}급` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.info.tuition_per_semester_krw
                        ? `${d.info.tuition_per_semester_krw.toLocaleString("vi-VN")} KRW`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Yêu cầu hồ sơ — 학과별 (발급서류 + 작성서류 양식) */}
      <Card title={`${tr(locale, "제출 서류", "Hồ sơ cần nộp")} (${docCount})`}>
        {departments.length === 0 ? (
          <p className="text-sm text-slate-500">{tr(locale, "데이터 없음", "Không có dữ liệu")}</p>
        ) : (
          <div className="space-y-5">
            {departments.map((d) => {
              const docs = byDept.get(d.id);
              const issued = docs?.issued ?? [];
              const forms = docs?.formFiles ?? [];
              return (
                <section key={d.id}>
                  <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                    {deptName(d)}
                    <span className="rounded border border-slate-300 px-1.5 py-0.5 text-xs font-normal">
                      {L(DEPT_KIND_LABEL, d.kind, locale)}
                    </span>
                    <span className="text-xs font-normal text-slate-400">
                      {tr(locale, "발급", "Xin cấp")} {issued.length} · {tr(locale, "양식", "Mẫu")} {forms.length}
                    </span>
                  </h3>
                  {issued.length === 0 ? (
                    <p className="text-xs text-slate-500">{tr(locale, "발급 서류 없음", "Không có giấy tờ cần xin cấp")}</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {issued.map((doc) => (
                        <li
                          key={`${doc.std_key}:${doc.target_person ?? ""}`}
                          className="rounded-md border border-slate-200 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium">
                                {docName(doc)}
                                {locale !== "ko" && doc.name_vi ? (
                                  <span className="ml-2 text-xs text-slate-500">
                                    ({doc.name_ko})
                                  </span>
                                ) : null}
                              </div>
                              {doc.notarization && doc.notarization !== "none" ? (
                                <div className="mt-0.5 text-xs text-slate-600">
                                  {tr(locale, "인증", "Xác thực")}:{" "}
                                  {L(NOTARIZATION_LABEL, doc.notarization, locale)}
                                </div>
                              ) : null}
                              {docNotes(doc) ? (
                                <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                                  {docNotes(doc)}
                                </div>
                              ) : null}
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                                !doc.required
                                  ? "border border-slate-300 text-slate-600"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {!doc.required ? tr(locale, "선택", "Tùy chọn") : tr(locale, "필수", "Bắt buộc")}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {forms.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-1 text-xs font-medium text-slate-600">
                        {tr(locale, "작성 서류 (학교 양식)", "Hồ sơ tự điền (mẫu trường)")}
                      </div>
                      <FormFilesList locale={locale} forms={forms} />
                    </div>
                  ) : null}
                </section>
              );
            })}
            <p className="text-xs text-slate-500">
              {tr(locale, "양식은 학교가 제공하는 것입니다. 작성해 다른 서류와 함께 제출합니다.", "Mẫu hồ sơ do trường cung cấp. Sinh viên điền và nộp cùng các giấy tờ khác.")}
            </p>
          </div>
        )}
      </Card>

      {/* Điều kiện đăng ký */}
      <Card title={tr(locale, "지원 자격", "Điều kiện đăng ký")}>
        <section className="space-y-3">
          <Subsection title={tr(locale, "학력", "Học vấn")}>
            <Dl>
              <Info
                label={tr(locale, "최소 요건", "Yêu cầu tối thiểu")}
                value={
                  eligibility.education_required
                    ? L(EDUCATION_LABEL, eligibility.education_required, locale)
                    : null
                }
              />
              <Info
                label={tr(locale, "최소 GPA", "GPA tối thiểu")}
                value={
                  eligibility.gpa_min != null
                    ? `${eligibility.gpa_min}${eligibility.gpa_scale ? ` / ${eligibility.gpa_scale}` : ""}`
                    : null
                }
              />
              <Info
                label={tr(locale, "나이", "Độ tuổi")}
                value={formatAgeRequirement(eligibility.age_requirement, locale)}
              />
              {eligibility.age_requirement?.notes ? (
                <Info
                  label={tr(locale, "나이 단서", "Ghi chú độ tuổi")}
                  value={eligibility.age_requirement.notes}
                />
              ) : null}
              {eligibility.education_exclusions &&
              eligibility.education_exclusions.length > 0 ? (
                <Info
                  label={tr(locale, "제외 대상", "Loại trừ")}
                  value={eligibility.education_exclusions.join(", ")}
                  full
                />
              ) : null}
            </Dl>
          </Subsection>

          {eligibility.korean_proficiency ? (
            <Subsection title={tr(locale, "한국어", "Tiếng Hàn")}>
              <Dl>
                <Info
                  label={tr(locale, "최소 TOPIK", "TOPIK tối thiểu")}
                  value={
                    eligibility.korean_proficiency.topik_min_default != null
                      ? tr(locale, `${eligibility.korean_proficiency.topik_min_default}급 이상`, `Cấp ${eligibility.korean_proficiency.topik_min_default} trở lên`)
                      : null
                  }
                />
                <Info
                  label={tr(locale, "입학 후", "Sau khi nhập học")}
                  value={
                    eligibility.korean_proficiency.post_admission_requirement ?? null
                  }
                />
              </Dl>
              {eligibility.korean_proficiency.alternative_paths &&
              eligibility.korean_proficiency.alternative_paths.length > 0 ? (
                <div className="mt-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {tr(locale, "TOPIK 대체 경로", "Đường thay thế TOPIK")}
                  </div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {eligibility.korean_proficiency.alternative_paths.map(
                      (p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-xs">
                            {p.type ? L(ALT_PATH_LABEL, p.type, locale) : "—"}
                          </span>
                          <span className="text-slate-600">
                            {p.level ? `${p.level} ` : ""}
                            {p.description ?? ""}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ) : null}
            </Subsection>
          ) : null}

          {eligibility.english_proficiency &&
          (eligibility.english_proficiency.minimums ||
            eligibility.english_proficiency.applies_to_departments) ? (
            <Subsection title={tr(locale, "영어", "Tiếng Anh")}>
              {eligibility.english_proficiency.applies_to_departments &&
              eligibility.english_proficiency.applies_to_departments.length > 0 ? (
                <div className="text-sm">
                  <span className="text-slate-500">{tr(locale, "적용 대상", "Áp dụng cho")}: </span>
                  {eligibility.english_proficiency.applies_to_departments.join(
                    ", "
                  )}
                </div>
              ) : null}
              {eligibility.english_proficiency.minimums ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.entries(eligibility.english_proficiency.minimums).map(
                    ([k, v]) => (
                      <span
                        key={k}
                        className="rounded border border-slate-300 px-2 py-0.5 text-xs"
                      >
                        {k}: {String(v)}
                      </span>
                    )
                  )}
                </div>
              ) : null}
            </Subsection>
          ) : null}

          {eligibility.financial_minimum ? (
            <Subsection title={tr(locale, "재정", "Tài chính")}>
              <Dl>
                <Info
                  label={tr(locale, "최소 잔고", "Số dư tối thiểu")}
                  value={fmtCur(
                    eligibility.financial_minimum.amount,
                    eligibility.financial_minimum.currency
                  )}
                />
                <Info
                  label={tr(locale, "유효 기간", "Thời hạn")}
                  value={
                    eligibility.financial_minimum.freshness_days != null
                      ? tr(locale, `${eligibility.financial_minimum.freshness_days}일`, `${eligibility.financial_minimum.freshness_days} ngày`)
                      : null
                  }
                />
                {eligibility.financial_minimum.holder_relations &&
                eligibility.financial_minimum.holder_relations.length > 0 ? (
                  <Info
                    label={tr(locale, "예금주", "Chủ tài khoản")}
                    value={eligibility.financial_minimum.holder_relations
                      .map((h) => L(HOLDER_LABEL, h, locale))
                      .join(", ")}
                    full
                  />
                ) : null}
              </Dl>
            </Subsection>
          ) : null}

          {eligibility.exclusions && eligibility.exclusions.length > 0 ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
              <div className="font-medium text-rose-700">{tr(locale, "지원 불가", "Không đủ điều kiện")}</div>
              <ul className="mt-1 list-disc pl-5 text-xs text-rose-800">
                {eligibility.exclusions.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </Card>

      {/* Lịch tuyển sinh — 학기별 */}
      <Card title={`${tr(locale, "모집 일정", "Lịch tuyển sinh")} (${termSchedules.length})`}>
        <div className="space-y-4">
          {termSchedules.map(({ term, schedule, notes }) => (
            <section key={term}>
              <h3 className="mb-2 text-sm font-medium text-slate-700">{term}</h3>
              {schedule.rounds && schedule.rounds.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">{tr(locale, "차수", "Đợt")}</th>
                        <th className="px-3 py-2 font-medium">{tr(locale, "원서 접수", "Nhận hồ sơ")}</th>
                        <th className="px-3 py-2 font-medium">{tr(locale, "면접", "Phỏng vấn")}</th>
                        <th className="px-3 py-2 font-medium">{tr(locale, "합격 발표", "Kết quả")}</th>
                        <th className="px-3 py-2 font-medium">{tr(locale, "등록금 납부", "Đóng học phí")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.rounds.map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium">{r.name ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            {r.application_open ?? "—"} ~ {r.application_close ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {r.interview
                              ? r.interview
                              : r.interview_period
                                ? `${r.interview_period[0]} ~ ${r.interview_period[1]}`
                                : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {r.result_announcement ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {r.payment_period
                              ? `${r.payment_period[0]} ~ ${r.payment_period[1]}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{tr(locale, "일정 없음", "Chưa có lịch")}</p>
              )}
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                <Info label={tr(locale, "개강", "Khai giảng")} value={schedule.semester_start} />
                <Info label={tr(locale, "종강", "Kết thúc")} value={schedule.semester_end} />
                <Info label={tr(locale, "제출 방법", "Hình thức nộp")} value={schedule.submission_method} />
              </div>
              {notes ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{notes}</p>
              ) : null}
            </section>
          ))}
        </div>
      </Card>

      {/* Học phí */}
      <Card title={tr(locale, "등록금", "Học phí")}>
        <Dl>
          <Info label={tr(locale, "지원료", "Phí đăng ký")} value={fmtCur(tuition.application_fee, tuition.currency)} />
          <Info label={tr(locale, "입학금", "Phí nhập học")} value={fmtCur(tuition.admission_fee, tuition.currency)} />
          <Info label={tr(locale, "학기 등록금", "Học phí/kỳ")} value={fmtCur(tuition.tuition_per_semester, tuition.currency)} />
          <Info label={tr(locale, "연간 등록금", "Học phí/năm")} value={fmtCur(tuition.tuition_per_year, tuition.currency)} />
          <Info label={tr(locale, "기숙사비", "Phí ký túc xá")} value={fmtCur(tuition.dorm_fee, tuition.currency)} />
          <Info label={tr(locale, "연간 보험료", "Bảo hiểm/năm")} value={fmtCur(tuition.insurance_per_year, tuition.currency)} />
          <Info label={tr(locale, "납부 방법", "Phương thức thanh toán")} value={tuition.payment_method} full />
        </Dl>
        {tuition.tuition_by_faculty &&
        Object.keys(tuition.tuition_by_faculty).length > 0 ? (
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {tr(locale, "학과별 등록금", "Học phí theo khoa")}
            </div>
            <div className="mt-1 overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(tuition.tuition_by_faculty).map(([k, v]) => (
                    <tr key={k} className="border-t border-slate-100 first:border-t-0">
                      <td className="px-3 py-2">{k}</td>
                      <td className="px-3 py-2 text-right">
                        {v.toLocaleString("vi-VN")} {tuition.currency ?? "KRW"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Học bổng */}
      <Card title={`${tr(locale, "장학금", "Học bổng")} (${scholarships.length})`}>
        {scholarships.length === 0 ? (
          <p className="text-sm text-slate-500">{tr(locale, "없음", "Không có")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {scholarships.map((s, i) => (
              <li key={i} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      {s.name ?? "—"}
                      <span className="ml-2 rounded border border-slate-300 px-1.5 py-0.5 text-xs font-normal">
                        {s.applies_to
                          ? L(APPLIES_TO_LABEL, s.applies_to, locale)
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {s.condition ?? "—"}
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium">
                    {typeof s.benefit_value === "number"
                      ? `${s.benefit_value.toLocaleString("vi-VN")}`
                      : s.benefit_value ?? "—"}
                  </div>
                </div>
                {s.tiered_by_topik ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(s.tiered_by_topik).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-xs"
                      >
                        TOPIK {k}: {typeof v === "number" ? v.toLocaleString("vi-VN") : v}
                      </span>
                    ))}
                  </div>
                ) : null}
                {s.notes ? (
                  <div className="mt-1 text-xs text-slate-500">{s.notes}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Sau khi trúng tuyển */}
      {metadata.post_acceptance ? (
        <Card title={tr(locale, "합격 이후 (비자·절차)", "Sau khi trúng tuyển (Visa·Thủ tục)")}>
          <Dl>
            <Info label={tr(locale, "입학 비자", "Visa nhập học")} value={metadata.post_acceptance.visa_type} />
            <Info
              label={tr(locale, "졸업 후 비자", "Visa sau tốt nghiệp")}
              value={metadata.post_acceptance.post_graduation_visa}
            />
            <Info
              label={tr(locale, "보험 요건", "Yêu cầu bảo hiểm")}
              value={metadata.post_acceptance.insurance_requirement}
              full
            />
          </Dl>
          {metadata.post_acceptance.warnings &&
          metadata.post_acceptance.warnings.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="font-medium text-amber-800">{tr(locale, "유의사항", "Lưu ý")}</div>
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
                {metadata.post_acceptance.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {metadata.post_acceptance.process_steps &&
          metadata.post_acceptance.process_steps.length > 0 ? (
            <div className="mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {tr(locale, "절차", "Quy trình")}
              </div>
              <ol className="mt-1 list-decimal pl-5 text-sm">
                {metadata.post_acceptance.process_steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Chỉ định chính phủ */}
      {metadata.government_designations &&
      metadata.government_designations.length > 0 ? (
        <Card title={tr(locale, "정부 지정", "Chỉ định của Chính phủ")}>
          <ul className="space-y-2 text-sm">
            {metadata.government_designations.map((g, i) => (
              <li
                key={i}
                className="rounded-md border border-emerald-200 bg-emerald-50 p-3"
              >
                <div className="font-medium text-emerald-900">
                  {g.designation_name ?? "—"}
                </div>
                {g.benefits && g.benefits.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.benefits.map((b, j) => (
                      <span
                        key={j}
                        className="rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-xs text-emerald-800"
                      >
                        {L(BENEFIT_LABEL, b, locale)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Liên hệ */}
      {metadata.contacts &&
      Object.values(metadata.contacts).some(
        (v) => v !== undefined && v !== null && v !== ""
      ) ? (
        <Card title={tr(locale, "학교 연락처", "Liên hệ trường")}>
          <Dl>
            <Info label={tr(locale, "부서", "Phòng/Ban")} value={metadata.contacts.department_name} />
            <Info label={tr(locale, "전화", "Điện thoại")} value={metadata.contacts.phone} />
            <Info label={tr(locale, "베트남어 상담 번호", "Số tiếng Việt")} value={metadata.contacts.phone_vietnamese} />
            <Info label="Email" value={metadata.contacts.email ?? null} />
            <Info label="Website" value={metadata.contacts.website} full />
            <Info
              label={tr(locale, "온라인 지원", "Đăng ký online")}
              value={metadata.contacts.online_apply_url}
              full
            />
            <Info label={tr(locale, "주소", "Địa chỉ")} value={metadata.contacts.address_ko} full />
          </Dl>
        </Card>
      ) : null}

      {/* Ghi chú riêng cho Việt Nam */}
      {metadata.country_specific_notes_vi ? (
        <Card title={tr(locale, "베트남 지원자 유의사항", "Lưu ý dành cho ứng viên Việt Nam")}>
          <p className="whitespace-pre-wrap text-sm">
            {metadata.country_specific_notes_vi}
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-3 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
      {children}
    </dl>
  );
}

function FormFilesList({
  forms,
  locale,
}: {
  locale: Locale;
  forms: Array<{
    id: string;
    key: string;
    name_ko: string;
    file_url: string;
    file_name: string;
    size_bytes: number | null;
  }>;
}) {
  return (
    <ul className="space-y-1">
      {forms.map((f) => (
        <li
          key={f.id}
          className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
        >
          <span className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-xs">
            {L(FORM_KEY_LABEL, f.key, locale)}
          </span>
          <a
            href={downloadUrl(f.file_url, f.name_ko, f.file_name)}
            className="flex-1 text-emerald-700 hover:underline"
          >
            {f.name_ko}
            <span className="ml-1 text-xs text-slate-400">({f.file_name})</span>
          </a>
          {f.size_bytes ? (
            <span className="shrink-0 text-xs text-slate-500">
              {(f.size_bytes / 1024).toFixed(0)} KB
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Info({
  label,
  value,
  full,
}: {
  label: string;
  value?: string | null;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}
