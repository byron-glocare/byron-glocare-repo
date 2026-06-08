/**
 * /admissions/[id] — 모집요강 상세 (글로케어 어드민).
 *   7 영역 본격 표시 (identity / departments / required_documents / eligibility / schedule / tuition / scholarships / metadata).
 *   편집은 후속 라운드 (/edit).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DeleteSpecButton } from "./delete-spec-button";

export const dynamic = "force-dynamic";

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "어학연수 (D-4)",
  associate_2yr: "전문학사 2년",
  bachelor_3yr_extension: "전공심화 (2+2)",
  bachelor_4yr: "학사 4년",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  reviewing: "검수 중",
  approved: "승인",
  archived: "보관",
};

const NOTARIZATION_LABEL: Record<string, string> = {
  none: "없음",
  translation_notarization: "번역 공증",
  consul: "영사확인",
  consul_for_vietnam: "베트남 영사확인",
  apostille: "아포스티유",
  apostille_or_consul: "아포스티유 또는 영사확인",
};

const EDUCATION_LABEL: Record<string, string> = {
  high_school: "고등학교 졸업",
  high_school_12yrs: "12년 정규 교육",
  health_related_bachelor: "보건계열 학사",
  bachelor: "학사",
  master: "석사",
};

const HOLDER_LABEL: Record<string, string> = {
  self: "본인",
  parent: "부모",
  guardian: "보호자",
  financial_sponsor: "재정보증인",
};

const ALT_PATH_LABEL: Record<string, string> = {
  sejong_institute: "세종학당",
  kiip: "사회통합프로그램(KIIP)",
  university_internal_test: "교내 한국어 시험",
  korean_education_center: "한국교육원",
  health_science_degree: "보건의료 학위",
  elder_care_career: "요양보호 경력",
};

const BENEFIT_LABEL: Record<string, string> = {
  relaxed_visa_financial: "비자 재정요건 완화",
  relaxed_stay_extension: "체류기간 연장 완화",
  e7_eligible_after_graduation: "졸업 후 E-7 자격",
  min_wage_guaranteed: "최저임금 보장",
  job_placement: "취업 알선",
  other: "기타",
};

type Dept = {
  faculty?: string | null;
  name?: string;
  track?: string | null;
  years?: number | null;
  capacity?: number | string | null;
  korean_min_topik?: number | null;
  tuition_per_semester_krw?: number | null;
};

type RequiredDoc = {
  key?: string;
  name_ko?: string;
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
  result_announcement?: string | null;
  payment_period?: [string, string];
};

export default async function AdmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: spec, error } = await supabase
    .from("study_admission_specs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !spec) notFound();

  const { data: university } = await supabase
    .from("universities")
    .select("id, name_ko, name_vi, region_ko")
    .eq("id", spec.university_id)
    .maybeSingle();

  const departments = (Array.isArray(spec.departments) ? spec.departments : []) as Dept[];
  const requiredDocs = (Array.isArray(spec.required_documents) ? spec.required_documents : []) as RequiredDoc[];
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
        notes?: string | null;
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
  const schedule = (spec.schedule ?? {}) as { rounds?: Round[]; semester_start?: string | null };
  const tuition = (spec.tuition ?? {}) as {
    unit?: string;
    currency?: string;
    application_fee?: number | null;
    tuition_per_semester?: number | null;
    tuition_by_faculty?: Record<string, number>;
  };
  const scholarships = (Array.isArray(spec.scholarships) ? spec.scholarships : []) as Scholarship[];
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
    forms?: {
      application_form?: boolean;
      self_intro?: boolean;
      study_plan?: boolean;
      financial_pledge?: boolean;
      privacy_consent?: boolean;
      academic_record_release?: boolean;
      notes?: string;
    };
    contacts?: {
      phone?: string;
      phone_vietnamese?: string;
      phone_korean?: string;
      fax?: string;
      email?: string | null;
      email_secondary?: string;
      address_ko?: string;
      address_en?: string;
      website?: string;
      online_apply_url?: string;
      department_name?: string;
      submission_hours?: string;
    };
    government_designations?: Array<{
      agency?: string;
      designation_name?: string;
      effective_from?: string;
      benefits?: string[];
      notes?: string;
    }>;
    language_program?: {
      hours_per_semester?: number;
      hours_per_week?: number;
      weeks_per_semester?: number;
      weekly_schedule?: string;
      visa_type?: string;
      visa_extension?: string;
    };
    country_specific_notes_vi?: string;
  };

  return (
    <>
      <PageHeader
        title={university?.name_ko ?? "?"}
        description={`${spec.term} · ${PROGRAM_TYPE_LABEL[spec.program_type] ?? spec.program_type}`}
        breadcrumbs={[
          { label: "입학서류", href: "/admissions" },
          {
            label: university?.name_ko ?? "상세",
            href: `/admissions/${spec.university_id}`,
          },
          { label: "모집요강" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={spec.status === "approved" ? "default" : "secondary"}>
              {STATUS_LABEL[spec.status] ?? spec.status}
            </Badge>
            <Link
              href={`/admissions/specs/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              편집
            </Link>
            <DeleteSpecButton specId={id} universityId={spec.university_id} />
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* 기본 정보 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">기본 정보</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            <Info label="대학교" value={university?.name_ko} />
            <Info label="베트남어" value={university?.name_vi} />
            <Info label="지역" value={university?.region_ko} />
            <Info label="학기" value={spec.term} />
            <Info label="과정" value={PROGRAM_TYPE_LABEL[spec.program_type] ?? spec.program_type} />
            <Info label="전형(내부)" value={spec.admission_category} />
            <Info label="학과 수" value={String(departments.length)} />
            <Info
              label="갱신"
              value={new Date(spec.updated_at).toLocaleString("ko-KR")}
            />
            {spec.approved_at ? (
              <Info
                label="승인"
                value={new Date(spec.approved_at).toLocaleString("ko-KR")}
              />
            ) : null}
          </dl>
        </Card>

        {/* 학과 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">학과 ({departments.length})</h2>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">학부</th>
                    <th className="px-3 py-2 font-medium">학과</th>
                    <th className="px-3 py-2 font-medium">트랙</th>
                    <th className="w-16 px-3 py-2 text-center font-medium">년수</th>
                    <th className="w-20 px-3 py-2 text-center font-medium">정원</th>
                    <th className="w-20 px-3 py-2 text-center font-medium">TOPIK</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">등록금(학기)</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{d.faculty ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{d.name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.track ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{d.years ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{d.capacity ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {d.korean_min_topik ? (
                          <Badge variant="outline">{d.korean_min_topik}급</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {d.tuition_per_semester_krw
                          ? `${d.tuition_per_semester_krw.toLocaleString()}원`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 제출 서류 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">제출 서류 ({requiredDocs.length})</h2>
          {requiredDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {requiredDocs.map((doc, i) => (
                <li key={i} className="flex items-start gap-3 rounded-md border p-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      {doc.name_ko ?? doc.key ?? "—"}
                      {doc.required === false ? (
                        <Badge variant="outline" className="ml-2 text-xs">선택</Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2 text-xs">필수</Badge>
                      )}
                    </div>
                    {doc.notarization && doc.notarization !== "none" ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        인증: {NOTARIZATION_LABEL[doc.notarization] ?? doc.notarization}
                      </div>
                    ) : null}
                    {doc.notes ? (
                      <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{doc.notes}</div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 자격 */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-semibold">지원 자격</h2>

          {/* 학력 */}
          <section>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">학력</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              <Info
                label="요구 학력"
                value={
                  eligibility.education_required
                    ? EDUCATION_LABEL[eligibility.education_required] ??
                      eligibility.education_required
                    : null
                }
              />
              <Info
                label="GPA 최소"
                value={
                  eligibility.gpa_min != null
                    ? `${eligibility.gpa_min}${eligibility.gpa_scale ? ` / ${eligibility.gpa_scale}` : ""}`
                    : null
                }
              />
              {eligibility.applicant_categories &&
              eligibility.applicant_categories.length > 0 ? (
                <Info
                  label="지원 카테고리"
                  value={eligibility.applicant_categories.join(", ")}
                  full
                />
              ) : null}
              {eligibility.education_paths &&
              eligibility.education_paths.length > 0 ? (
                <Info
                  label="허용 경로"
                  value={eligibility.education_paths.join(", ")}
                  full
                />
              ) : null}
              {eligibility.education_exclusions &&
              eligibility.education_exclusions.length > 0 ? (
                <Info
                  label="제외 학력"
                  value={eligibility.education_exclusions.join(", ")}
                  full
                />
              ) : null}
            </dl>
          </section>

          {/* 한국어 */}
          {eligibility.korean_proficiency ? (
            <section>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                한국어 능력
              </h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                <Info
                  label="기본 TOPIK"
                  value={
                    eligibility.korean_proficiency.topik_min_default != null
                      ? `${eligibility.korean_proficiency.topik_min_default}급 이상`
                      : null
                  }
                />
                <Info
                  label="입학 후 요건"
                  value={
                    eligibility.korean_proficiency.post_admission_requirement ?? null
                  }
                />
              </dl>
              {eligibility.korean_proficiency.alternative_paths &&
              eligibility.korean_proficiency.alternative_paths.length > 0 ? (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    TOPIK 대체 경로
                  </div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {eligibility.korean_proficiency.alternative_paths.map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {p.type ? ALT_PATH_LABEL[p.type] ?? p.type : "—"}
                        </Badge>
                        <span className="text-muted-foreground">
                          {p.level ? `${p.level} ` : ""}
                          {p.description ?? ""}
                          {p.notes ? ` (${p.notes})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* 영어 */}
          {eligibility.english_proficiency &&
          (eligibility.english_proficiency.minimums ||
            eligibility.english_proficiency.applies_to_departments) ? (
            <section>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                영어 능력
              </h3>
              {eligibility.english_proficiency.applies_to_departments &&
              eligibility.english_proficiency.applies_to_departments.length > 0 ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">대상: </span>
                  {eligibility.english_proficiency.applies_to_departments.join(", ")}
                </div>
              ) : null}
              {eligibility.english_proficiency.minimums ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(eligibility.english_proficiency.minimums).map(
                    ([k, v]) => (
                      <Badge key={k} variant="outline">
                        {k}: {String(v)}
                      </Badge>
                    )
                  )}
                </div>
              ) : null}
              {eligibility.english_proficiency.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {eligibility.english_proficiency.notes}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* 재정 */}
          {eligibility.financial_minimum ? (
            <section>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">재정</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                <Info
                  label="최소 금액"
                  value={
                    eligibility.financial_minimum.amount != null
                      ? `${eligibility.financial_minimum.amount.toLocaleString()} ${eligibility.financial_minimum.currency ?? "KRW"}`
                      : null
                  }
                />
                <Info
                  label="유효 기간"
                  value={
                    eligibility.financial_minimum.freshness_days != null
                      ? `${eligibility.financial_minimum.freshness_days}일`
                      : null
                  }
                />
                {eligibility.financial_minimum.holder_relations &&
                eligibility.financial_minimum.holder_relations.length > 0 ? (
                  <Info
                    label="예금주"
                    value={eligibility.financial_minimum.holder_relations
                      .map((h) => HOLDER_LABEL[h] ?? h)
                      .join(", ")}
                    full
                  />
                ) : null}
                {eligibility.financial_minimum.notes ? (
                  <Info
                    label="재정 메모"
                    value={eligibility.financial_minimum.notes}
                    full
                  />
                ) : null}
              </dl>
            </section>
          ) : null}

          {/* 제외사항·메모 */}
          {(eligibility.exclusions && eligibility.exclusions.length > 0) ||
          eligibility.notes_ko ? (
            <section>
              {eligibility.exclusions && eligibility.exclusions.length > 0 ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="font-medium text-destructive">자격 제외사항</div>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {eligibility.exclusions.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {eligibility.notes_ko ? (
                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {eligibility.notes_ko}
                </p>
              ) : null}
            </section>
          ) : null}
        </Card>

        {/* 일정 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">모집 일정</h2>
          {schedule.rounds && schedule.rounds.length > 0 ? (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">차수</th>
                    <th className="px-3 py-2 font-medium">접수</th>
                    <th className="px-3 py-2 font-medium">서류마감</th>
                    <th className="px-3 py-2 font-medium">면접</th>
                    <th className="px-3 py-2 font-medium">발표</th>
                    <th className="px-3 py-2 font-medium">등록</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.rounds.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.application_open ?? "—"} ~ {r.application_close ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.document_submission_close ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.interview_period
                          ? `${r.interview_period[0]} ~ ${r.interview_period[1]}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.result_announcement ?? "—"}</td>
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
            <p className="text-sm text-muted-foreground">없음</p>
          )}
          {schedule.semester_start ? (
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">개강: </span>
              <span className="font-medium">{schedule.semester_start}</span>
            </p>
          ) : null}
        </Card>

        {/* 등록금 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">등록금</h2>
          {tuition.tuition_by_faculty && Object.keys(tuition.tuition_by_faculty).length > 0 ? (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">계열</th>
                    <th className="px-3 py-2 text-right font-medium">학기당 ({tuition.currency ?? "KRW"})</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tuition.tuition_by_faculty).map(([k, v]) => (
                    <tr key={k} className="border-t">
                      <td className="px-3 py-2">{k}</td>
                      <td className="px-3 py-2 text-right">{v.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tuition.tuition_per_semester ? (
            <p className="text-sm">
              학기당 {tuition.tuition_per_semester.toLocaleString()}원
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">미정 (합격 후 안내)</p>
          )}
        </Card>

        {/* 장학금 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">장학금 ({scholarships.length})</h2>
          {scholarships.length === 0 ? (
            <p className="text-sm text-muted-foreground">없음</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {scholarships.map((s, i) => (
                <li key={i} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-medium">
                        {s.name ?? "—"}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {s.applies_to === "freshman" ? "신입생" : s.applies_to === "enrolled" ? "재학생" : "공통"}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.condition ?? "—"}</div>
                    </div>
                    <div className="text-right text-sm font-medium">
                      {typeof s.benefit_value === "number"
                        ? `${s.benefit_value.toLocaleString()}원`
                        : s.benefit_value ?? "—"}
                    </div>
                  </div>
                  {s.tiered_by_topik ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(s.tiered_by_topik).map(([k, v]) => (
                        <Badge key={k} variant="secondary" className="text-xs">
                          TOPIK {k}급: {typeof v === "number" ? `${v.toLocaleString()}원` : v}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 선발 절차 */}
        {metadata.selection_process &&
        Object.values(metadata.selection_process).some(
          (v) => v !== undefined && v !== null && v !== ""
        ) ? (
          <Card className="p-6">
            <h2 className="mb-3 text-base font-semibold">선발 절차</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              <Info label="선발 방법" value={metadata.selection_process.method} />
              <Info
                label="면접"
                value={
                  metadata.selection_process.interview_required ? "필수" : "없음"
                }
              />
              {metadata.selection_process.interview_content &&
              metadata.selection_process.interview_content.length > 0 ? (
                <Info
                  label="면접 내용"
                  value={metadata.selection_process.interview_content.join(", ")}
                  full
                />
              ) : null}
              <Info
                label="평가 기준"
                value={metadata.selection_process.evaluation_criteria}
                full
              />
            </dl>
          </Card>
        ) : null}

        {/* 합격 후 (비자·절차) */}
        {metadata.post_acceptance ? (
          <Card className="p-6">
            <h2 className="mb-3 text-base font-semibold">합격 후 (비자·절차)</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              <Info label="입학 비자" value={metadata.post_acceptance.visa_type} />
              <Info
                label="졸업 후 비자"
                value={metadata.post_acceptance.post_graduation_visa}
              />
              <Info
                label="보험 요건"
                value={metadata.post_acceptance.insurance_requirement}
                full
              />
            </dl>
            {metadata.post_acceptance.warnings &&
            metadata.post_acceptance.warnings.length > 0 ? (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <div className="font-medium text-amber-700 dark:text-amber-400">
                  주의사항
                </div>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {metadata.post_acceptance.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {metadata.post_acceptance.process_steps &&
            metadata.post_acceptance.process_steps.length > 0 ? (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  절차
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

        {/* 연락처 */}
        {metadata.contacts &&
        Object.values(metadata.contacts).some(
          (v) => v !== undefined && v !== null && v !== ""
        ) ? (
          <Card className="p-6">
            <h2 className="mb-3 text-base font-semibold">연락처</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              <Info
                label="담당 부서"
                value={metadata.contacts.department_name}
              />
              <Info label="전화" value={metadata.contacts.phone} />
              <Info
                label="베트남어 응대"
                value={metadata.contacts.phone_vietnamese}
              />
              <Info
                label="한국어 응대"
                value={metadata.contacts.phone_korean}
              />
              <Info label="이메일" value={metadata.contacts.email ?? null} />
              <Info
                label="보조 이메일"
                value={metadata.contacts.email_secondary}
              />
              <Info label="팩스" value={metadata.contacts.fax} />
              <Info
                label="접수 시간"
                value={metadata.contacts.submission_hours}
              />
              <Info label="웹사이트" value={metadata.contacts.website} full />
              <Info
                label="온라인 지원 URL"
                value={metadata.contacts.online_apply_url}
                full
              />
              <Info
                label="주소 (한국어)"
                value={metadata.contacts.address_ko}
                full
              />
              <Info
                label="주소 (영어)"
                value={metadata.contacts.address_en}
                full
              />
            </dl>
          </Card>
        ) : null}

        {/* 정부 지정 */}
        {metadata.government_designations &&
        metadata.government_designations.length > 0 ? (
          <Card className="p-6">
            <h2 className="mb-3 text-base font-semibold">정부 지정</h2>
            <ul className="space-y-2 text-sm">
              {metadata.government_designations.map((g, i) => (
                <li
                  key={i}
                  className="rounded-md border border-success/30 bg-success/5 p-3"
                >
                  <div className="font-medium">
                    {g.designation_name ?? "—"}
                    {g.effective_from ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (시행: {g.effective_from})
                      </span>
                    ) : null}
                  </div>
                  {g.benefits && g.benefits.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {g.benefits.map((b, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {BENEFIT_LABEL[b] ?? b}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {g.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {g.notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* 어학연수 프로그램 */}
        {metadata.language_program &&
        Object.values(metadata.language_program).some(
          (v) => v !== undefined && v !== null && v !== ""
        ) ? (
          <Card className="p-6">
            <h2 className="mb-3 text-base font-semibold">어학연수 프로그램</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
              <Info
                label="학기당 시간"
                value={
                  metadata.language_program.hours_per_semester != null
                    ? `${metadata.language_program.hours_per_semester}시간`
                    : null
                }
              />
              <Info
                label="주당 시간"
                value={
                  metadata.language_program.hours_per_week != null
                    ? `${metadata.language_program.hours_per_week}시간`
                    : null
                }
              />
              <Info
                label="학기 주수"
                value={
                  metadata.language_program.weeks_per_semester != null
                    ? `${metadata.language_program.weeks_per_semester}주`
                    : null
                }
              />
              <Info
                label="시간표"
                value={metadata.language_program.weekly_schedule}
              />
              <Info label="비자" value={metadata.language_program.visa_type} />
              <Info
                label="연장 비자"
                value={metadata.language_program.visa_extension}
              />
            </dl>
          </Card>
        ) : null}

        {/* 베트남 특화 메모 */}
        {metadata.country_specific_notes_vi ? (
          <Card className="p-6">
            <h2 className="mb-3 text-base font-semibold">베트남 특화 안내</h2>
            <p className="whitespace-pre-wrap text-sm">
              {metadata.country_specific_notes_vi}
            </p>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Info({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? "—"}</dd>
    </div>
  );
}

