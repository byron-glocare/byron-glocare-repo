/**
 * /center/admissions/[id] — 모집요강 상세 (유학센터 read-only, 베트남어 UI).
 *   approved 상태만 조회 가능 (RLS).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "Khóa tiếng (D-4)",
  associate_2yr: "Cao đẳng 2 năm",
  bachelor_3yr_extension: "Liên thông 2+2",
  bachelor_4yr: "Cử nhân 4 năm",
};

const NOTARIZATION_LABEL: Record<string, string> = {
  none: "Không cần",
  translation_notarization: "Công chứng dịch",
  consul: "Hợp pháp hóa lãnh sự",
  consul_for_vietnam: "Hợp pháp hóa lãnh sự Việt Nam",
  apostille: "Apostille",
  apostille_or_consul: "Apostille hoặc HPHLS",
};

const EDUCATION_LABEL: Record<string, string> = {
  high_school: "Tốt nghiệp THPT",
  high_school_12yrs: "12 năm giáo dục chính quy",
  health_related_bachelor: "Cử nhân ngành y tế",
  bachelor: "Cử nhân",
  master: "Thạc sĩ",
};

const HOLDER_LABEL: Record<string, string> = {
  self: "Bản thân",
  parent: "Cha mẹ",
  guardian: "Người giám hộ",
  financial_sponsor: "Người bảo lãnh tài chính",
};

const ALT_PATH_LABEL: Record<string, string> = {
  sejong_institute: "Học viện Sejong",
  kiip: "Chương trình KIIP",
  university_internal_test: "Kỳ thi tiếng Hàn nội bộ",
  korean_education_center: "Trung tâm giáo dục Hàn Quốc",
  health_science_degree: "Bằng y tế",
  elder_care_career: "Kinh nghiệm chăm sóc",
};

const BENEFIT_LABEL: Record<string, string> = {
  relaxed_visa_financial: "Giảm yêu cầu tài chính visa",
  relaxed_stay_extension: "Gia hạn cư trú dễ dàng",
  e7_eligible_after_graduation: "Đủ điều kiện E-7 sau tốt nghiệp",
  min_wage_guaranteed: "Đảm bảo lương tối thiểu",
  job_placement: "Hỗ trợ việc làm",
  other: "Khác",
};

const APPLIES_TO_LABEL: Record<string, string> = {
  freshman: "Tân sinh viên",
  enrolled: "Sinh viên đang học",
  both: "Cả hai",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Đã duyệt",
};

const FORM_KEY_LABEL: Record<string, string> = {
  application_form: "Đơn đăng ký nhập học",
  self_intro: "Bản giới thiệu bản thân",
  study_plan: "Kế hoạch học tập",
  financial_pledge_form: "Cam kết tài chính",
  privacy_consent: "Đồng ý bảo mật thông tin",
  academic_record_release: "Đồng ý cung cấp học bạ",
  recommendation_letter: "Thư giới thiệu",
  health_certificate: "Giấy khám sức khỏe (mẫu)",
  other: "Khác",
};

type Dept = {
  faculty?: string | null;
  name?: string;
  track?: string | null;
  years?: number | null;
  capacity?: number | string | null;
  korean_min_topik?: number | null;
  tuition_per_semester_krw?: number | null;
  notes?: string | null;
};

type RequiredDoc = {
  key?: string;
  name_ko?: string;
  name_vi?: string | null;
  required?: boolean;
  notarization?: string;
  language?: string;
  notes?: string | null;
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

  const departments = (Array.isArray(spec.departments) ? spec.departments : []) as Dept[];
  const requiredDocs = (Array.isArray(spec.required_documents) ? spec.required_documents : []) as RequiredDoc[];
  const scholarships = (Array.isArray(spec.scholarships) ? spec.scholarships : []) as Scholarship[];

  // 양식 파일 (B4-1) — 대학 전체 + 학과별 override
  //   학과별이 있으면 그 학과 학생은 학과별 우선, 없으면 대학 전체.
  const { data: formFiles } = await supabase
    .from("study_admission_form_files")
    .select("*")
    .eq("university_id", spec.university_id)
    .eq("is_current", true)
    .order("department_name", { ascending: true, nullsFirst: true });

  // 학과별 그룹화: 같은 (department_name, key) 의 가장 최근 1건만
  type FormFile = {
    id: string;
    department_name: string | null;
    key: string;
    name_ko: string;
    file_url: string;
    file_name: string;
    size_bytes: number | null;
  };
  const universalForms: FormFile[] = [];
  const deptOverrides = new Map<string, FormFile[]>(); // department_name → forms[]
  for (const f of (formFiles ?? []) as FormFile[]) {
    if (f.department_name === null) {
      universalForms.push(f);
    } else {
      if (!deptOverrides.has(f.department_name)) {
        deptOverrides.set(f.department_name, []);
      }
      deptOverrides.get(f.department_name)!.push(f);
    }
  }

  const schedule = (spec.schedule ?? {}) as {
    rounds?: Round[];
    semester_start?: string | null;
    semester_end?: string | null;
    submission_method?: string;
  };

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
    return `${n.toLocaleString("vi-VN")} ${currency ?? "KRW"}`;
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
            ← Quay lại danh sách
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {university?.name_ko ?? "?"}
          </h1>
          {university?.name_vi ? (
            <p className="mt-0.5 text-sm text-slate-600">{university.name_vi}</p>
          ) : null}
          <p className="mt-1 text-sm text-slate-500">
            {spec.term} ·{" "}
            {PROGRAM_TYPE_LABEL[spec.program_type] ?? spec.program_type}
            {university?.region_ko ? ` · ${university.region_ko}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          {STATUS_LABEL[spec.status] ?? spec.status}
        </span>
      </div>

      {/* Học khoa */}
      <Card title={`Ngành học (${departments.length})`}>
        {departments.length === 0 ? (
          <p className="text-sm text-slate-500">Không có dữ liệu</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Khoa</th>
                  <th className="px-3 py-2 font-medium">Ngành</th>
                  <th className="px-3 py-2 font-medium">Hệ</th>
                  <th className="w-16 px-3 py-2 text-center font-medium">Năm</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">Chỉ tiêu</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">TOPIK</th>
                  <th className="w-36 px-3 py-2 text-right font-medium">Học phí/kỳ</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-600">{d.faculty ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{d.name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{d.track ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{d.years ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{d.capacity ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {d.korean_min_topik ? `${d.korean_min_topik}급` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.tuition_per_semester_krw
                        ? `${d.tuition_per_semester_krw.toLocaleString("vi-VN")} KRW`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Yêu cầu hồ sơ */}
      <Card title={`Hồ sơ cần nộp (${requiredDocs.length})`}>
        {requiredDocs.length === 0 ? (
          <p className="text-sm text-slate-500">Không có dữ liệu</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {requiredDocs.map((doc, i) => (
              <li
                key={i}
                className="rounded-md border border-slate-200 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium">
                      {doc.name_vi || doc.name_ko || doc.key || "—"}
                      {doc.name_vi && doc.name_ko ? (
                        <span className="ml-2 text-xs text-slate-500">
                          ({doc.name_ko})
                        </span>
                      ) : null}
                    </div>
                    {doc.notarization && doc.notarization !== "none" ? (
                      <div className="mt-0.5 text-xs text-slate-600">
                        Xác thực:{" "}
                        {NOTARIZATION_LABEL[doc.notarization] ?? doc.notarization}
                      </div>
                    ) : null}
                    {doc.notes ? (
                      <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                        {doc.notes}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      doc.required === false
                        ? "border border-slate-300 text-slate-600"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {doc.required === false ? "Tùy chọn" : "Bắt buộc"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Điều kiện đăng ký */}
      <Card title="Điều kiện đăng ký">
        <section className="space-y-3">
          <Subsection title="Học vấn">
            <Dl>
              <Info
                label="Yêu cầu tối thiểu"
                value={
                  eligibility.education_required
                    ? EDUCATION_LABEL[eligibility.education_required] ??
                      eligibility.education_required
                    : null
                }
              />
              <Info
                label="GPA tối thiểu"
                value={
                  eligibility.gpa_min != null
                    ? `${eligibility.gpa_min}${eligibility.gpa_scale ? ` / ${eligibility.gpa_scale}` : ""}`
                    : null
                }
              />
              {eligibility.education_exclusions &&
              eligibility.education_exclusions.length > 0 ? (
                <Info
                  label="Loại trừ"
                  value={eligibility.education_exclusions.join(", ")}
                  full
                />
              ) : null}
            </Dl>
          </Subsection>

          {eligibility.korean_proficiency ? (
            <Subsection title="Tiếng Hàn">
              <Dl>
                <Info
                  label="TOPIK tối thiểu"
                  value={
                    eligibility.korean_proficiency.topik_min_default != null
                      ? `Cấp ${eligibility.korean_proficiency.topik_min_default} trở lên`
                      : null
                  }
                />
                <Info
                  label="Sau khi nhập học"
                  value={
                    eligibility.korean_proficiency.post_admission_requirement ?? null
                  }
                />
              </Dl>
              {eligibility.korean_proficiency.alternative_paths &&
              eligibility.korean_proficiency.alternative_paths.length > 0 ? (
                <div className="mt-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Đường thay thế TOPIK
                  </div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {eligibility.korean_proficiency.alternative_paths.map(
                      (p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-xs">
                            {p.type ? ALT_PATH_LABEL[p.type] ?? p.type : "—"}
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
            <Subsection title="Tiếng Anh">
              {eligibility.english_proficiency.applies_to_departments &&
              eligibility.english_proficiency.applies_to_departments.length > 0 ? (
                <div className="text-sm">
                  <span className="text-slate-500">Áp dụng cho: </span>
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
            <Subsection title="Tài chính">
              <Dl>
                <Info
                  label="Số dư tối thiểu"
                  value={fmtCur(
                    eligibility.financial_minimum.amount,
                    eligibility.financial_minimum.currency
                  )}
                />
                <Info
                  label="Thời hạn"
                  value={
                    eligibility.financial_minimum.freshness_days != null
                      ? `${eligibility.financial_minimum.freshness_days} ngày`
                      : null
                  }
                />
                {eligibility.financial_minimum.holder_relations &&
                eligibility.financial_minimum.holder_relations.length > 0 ? (
                  <Info
                    label="Chủ tài khoản"
                    value={eligibility.financial_minimum.holder_relations
                      .map((h) => HOLDER_LABEL[h] ?? h)
                      .join(", ")}
                    full
                  />
                ) : null}
              </Dl>
            </Subsection>
          ) : null}

          {eligibility.exclusions && eligibility.exclusions.length > 0 ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
              <div className="font-medium text-rose-700">Không đủ điều kiện</div>
              <ul className="mt-1 list-disc pl-5 text-xs text-rose-800">
                {eligibility.exclusions.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </Card>

      {/* Lịch tuyển sinh */}
      <Card title="Lịch tuyển sinh">
        {schedule.rounds && schedule.rounds.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Đợt</th>
                  <th className="px-3 py-2 font-medium">Nhận hồ sơ</th>
                  <th className="px-3 py-2 font-medium">Phỏng vấn</th>
                  <th className="px-3 py-2 font-medium">Kết quả</th>
                  <th className="px-3 py-2 font-medium">Đóng học phí</th>
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
          <p className="text-sm text-slate-500">Chưa có lịch</p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
          <Info label="Khai giảng" value={schedule.semester_start} />
          <Info label="Kết thúc" value={schedule.semester_end} />
          <Info label="Hình thức nộp" value={schedule.submission_method} />
        </div>
      </Card>

      {/* Học phí */}
      <Card title="Học phí">
        <Dl>
          <Info label="Phí đăng ký" value={fmtCur(tuition.application_fee, tuition.currency)} />
          <Info label="Phí nhập học" value={fmtCur(tuition.admission_fee, tuition.currency)} />
          <Info label="Học phí/kỳ" value={fmtCur(tuition.tuition_per_semester, tuition.currency)} />
          <Info label="Học phí/năm" value={fmtCur(tuition.tuition_per_year, tuition.currency)} />
          <Info label="Phí ký túc xá" value={fmtCur(tuition.dorm_fee, tuition.currency)} />
          <Info label="Bảo hiểm/năm" value={fmtCur(tuition.insurance_per_year, tuition.currency)} />
          <Info label="Phương thức thanh toán" value={tuition.payment_method} full />
        </Dl>
        {tuition.tuition_by_faculty &&
        Object.keys(tuition.tuition_by_faculty).length > 0 ? (
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Học phí theo khoa
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
      <Card title={`Học bổng (${scholarships.length})`}>
        {scholarships.length === 0 ? (
          <p className="text-sm text-slate-500">Không có</p>
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
                          ? APPLIES_TO_LABEL[s.applies_to] ?? s.applies_to
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

      {/* Mẫu hồ sơ (양식 파일) */}
      {universalForms.length > 0 || deptOverrides.size > 0 ? (
        <Card title="Mẫu hồ sơ tải xuống">
          {/* 학과별 override 가 있는 경우 우선 표시 */}
          {deptOverrides.size > 0 ? (
            <div className="space-y-3">
              {Array.from(deptOverrides.entries()).map(([dept, forms]) => (
                <div key={dept}>
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    {dept} <span className="text-slate-400">(riêng cho ngành này)</span>
                  </div>
                  <FormFilesList forms={forms} />
                </div>
              ))}
              {universalForms.length > 0 ? (
                <div className="mt-3 border-t pt-3">
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    Áp dụng chung toàn trường
                  </div>
                  <FormFilesList forms={universalForms} />
                </div>
              ) : null}
            </div>
          ) : (
            <FormFilesList forms={universalForms} />
          )}
          <p className="mt-2 text-xs text-slate-500">
            Mẫu hồ sơ do trường cung cấp. Sinh viên điền và nộp cùng các giấy tờ khác.
          </p>
        </Card>
      ) : null}

      {/* Sau khi trúng tuyển */}
      {metadata.post_acceptance ? (
        <Card title="Sau khi trúng tuyển (Visa·Thủ tục)">
          <Dl>
            <Info label="Visa nhập học" value={metadata.post_acceptance.visa_type} />
            <Info
              label="Visa sau tốt nghiệp"
              value={metadata.post_acceptance.post_graduation_visa}
            />
            <Info
              label="Yêu cầu bảo hiểm"
              value={metadata.post_acceptance.insurance_requirement}
              full
            />
          </Dl>
          {metadata.post_acceptance.warnings &&
          metadata.post_acceptance.warnings.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="font-medium text-amber-800">Lưu ý</div>
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
                Quy trình
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
        <Card title="Chỉ định của Chính phủ">
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
                        {BENEFIT_LABEL[b] ?? b}
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
        <Card title="Liên hệ trường">
          <Dl>
            <Info label="Phòng/Ban" value={metadata.contacts.department_name} />
            <Info label="Điện thoại" value={metadata.contacts.phone} />
            <Info label="Số tiếng Việt" value={metadata.contacts.phone_vietnamese} />
            <Info label="Email" value={metadata.contacts.email ?? null} />
            <Info label="Website" value={metadata.contacts.website} full />
            <Info
              label="Đăng ký online"
              value={metadata.contacts.online_apply_url}
              full
            />
            <Info label="Địa chỉ" value={metadata.contacts.address_ko} full />
          </Dl>
        </Card>
      ) : null}

      {/* Ghi chú riêng cho Việt Nam */}
      {metadata.country_specific_notes_vi ? (
        <Card title="Lưu ý dành cho ứng viên Việt Nam">
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
}: {
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
            {FORM_KEY_LABEL[f.key] ?? f.key}
          </span>
          <a
            href={f.file_url}
            target="_blank"
            rel="noreferrer"
            download={f.file_name}
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
