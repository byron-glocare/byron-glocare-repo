/**
 * /admissions/specs/[id] — 모집요강 상세 (대학당 1개 · 학과별 서류 · 학기별 일정, 0067).
 *   머리: 대학 · 전형 이름 · 상태 · 학기 목록
 *   학과: 어학당 먼저. 학과마다 정보 · 학비·장학금 · 작성서류 양식 · 발급서류 항목 · 지원 자격(학과별; 비면 옛 요강 공통 폴백)
 *         어학당은 어학연수 프로그램(info.language_program; 옛 metadata.language_program 폴백)
 *   학기: 학기마다 일정(일반학과 · 어학당 따로) + 모집하는 학과(모집 행 상태)
 *   기타(선발·연락처·정부지정 등) — 합격 후·어학연수 프로그램 카드는 폐기(0068)
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, Pencil, Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { classifyRequiredDocs, isFormDoc, type RequiredDoc as ClassifyDoc } from "@/lib/admission/classify-documents";
import { loadFormDocKeys } from "@/lib/admission/form-doc-keys";
import { expandItem, loadDocCatalog, TARGET_LABEL_KO, type DocCatalog, type SpecDocItemRow } from "@/lib/admission/spec-doc-items";
import {
  KIND_LABEL,
  loadDocItemRowsByDepartment,
  loadFormFilesByDepartment,
  loadSpecDepartments,
  loadSpecTerms,
  type SpecDepartment,
  type SpecFormFile,
} from "@/lib/admission/spec-departments";
import { formatAgeRequirement, type AgeRequirementLike } from "@/lib/admission/age-requirement";
import { DeleteSpecButton } from "./delete-spec-button";
import { AddTermButton } from "./add-term-button";
import { DeleteFormFileButton } from "@/components/admission/delete-form-file-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { draft: "초안", reviewing: "검수 중", approved: "승인", archived: "보관" };
const OFFERING_STATUS_LABEL: Record<string, string> = { draft: "초안", published: "노출 중", closed: "마감", archived: "보관" };

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

const HOLDER_LABEL: Record<string, string> = { self: "본인", parent: "부모", guardian: "보호자", financial_sponsor: "재정보증인" };

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
  interview?: string | null;
  interview_period?: [string, string];
  result_announcement?: string | null;
  payment_period?: [string, string];
};

type ScheduleShape = { rounds?: Round[]; semester_start?: string | null; semester_end?: string | null; orientation?: string | null; submission_method?: string };

type Tuition = {
  unit?: string;
  currency?: string;
  application_fee?: number | null;
  tuition_per_semester?: number | null;
  tuition_per_year?: number | null;
  tuition_by_faculty?: Record<string, number>;
  disclosure_state?: string;
};

type EligibilityShape = {
  applicant_categories?: string[];
  age_requirement?: AgeRequirementLike | null;
  education_required?: string;
  education_paths?: string[];
  education_exclusions?: string[];
  gpa_min?: number | null;
  gpa_scale?: string | null;
  korean_proficiency?: {
    topik_min_default?: number | null;
    alternative_paths?: Array<{ type?: string; level?: string; description?: string; notes?: string | null }>;
    post_admission_requirement?: string | null;
  };
  english_proficiency?: { applies_to_departments?: string[]; minimums?: Record<string, number | string>; notes?: string };
  financial_minimum?: { amount?: number | null; currency?: string; holder_relations?: string[]; freshness_days?: number | null; notes?: string | null } | null;
  exclusions?: string[];
  notes_ko?: string;
};

type MetadataShape = {
  selection_process?: { method?: string; interview_required?: boolean; interview_content?: string[]; evaluation_criteria?: string };
  post_acceptance?: { visa_type?: string; post_graduation_visa?: string; insurance_requirement?: string; warnings?: string[]; process_steps?: string[] };
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
  government_designations?: Array<{ agency?: string; designation_name?: string; effective_from?: string; benefits?: string[]; notes?: string }>;
  language_program?: LanguageProgramShape;
  country_specific_notes_vi?: string;
};

type LanguageProgramShape = {
  hours_per_semester?: number | null;
  hours_per_week?: number | null;
  weeks_per_semester?: number | null;
  weekly_schedule?: string | null;
  visa_type?: string | null;
  visa_extension?: string | null;
};

export default async function AdmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: spec, error } = await supabase.from("study_admission_specs").select("*").eq("id", id).maybeSingle();
  if (error || !spec) notFound();

  const [{ data: university }, formDocKeys, docCatalog, departments, terms, rowsByDept, filesByDept, { data: offeringRows }] = await Promise.all([
    supabase.from("universities").select("id, name_ko, name_vi, region_ko").eq("id", spec.university_id).maybeSingle(),
    loadFormDocKeys(supabase),
    loadDocCatalog(supabase),
    loadSpecDepartments(supabase, id),
    loadSpecTerms(supabase, id),
    loadDocItemRowsByDepartment(supabase, id),
    loadFormFilesByDepartment(supabase, spec.university_id),
    supabase.from("study_offerings").select("id, department_id, term, status, intake_quota").eq("university_id", spec.university_id),
  ]);
  const offerings = offeringRows ?? [];
  const deptNameById = new Map(departments.map((d) => [d.department_id, d]));

  // 옛 JSONB — 작성서류 줄(양식 등록 여부 표시)과 표준에 안 붙은 발급서류 줄
  const legacyDocs = (Array.isArray(spec.required_documents) ? spec.required_documents : []) as ClassifyDoc[];
  const { forms: formDocs } = classifyRequiredDocs(legacyDocs, formDocKeys);
  const unlinkedIssued = legacyDocs.filter((d) => {
    const std = String(d.std_key ?? "").trim();
    return !isFormDoc(d, formDocKeys) && (std === "" || std === "__none__");
  });
  const allCurrentFileKeys = new Set(Array.from(filesByDept.values()).flat().map((f) => f.key));

  // 옛 요강 공통 자격 — 학과 자격이 비어 있을 때만 폴백으로 보여준다(0068: 자격은 학과별)
  const specEligibility = (spec.eligibility && typeof spec.eligibility === "object" && Object.keys(spec.eligibility as object).length ? spec.eligibility : null) as EligibilityShape | null;
  const metadata = (spec.metadata ?? {}) as MetadataShape;
  const docItemCount = Array.from(rowsByDept.values()).reduce((n, r) => n + r.length, 0);

  return (
    <>
      <PageHeader
        title={university?.name_ko ?? "?"}
        description={[spec.admission_category, terms.length ? `학기 ${terms.map((t) => t.term).join(" · ")}` : "학기 없음", `학과 ${departments.length}`].filter(Boolean).join(" · ")}
        breadcrumbs={[
          { label: "입학서류", href: "/admissions" },
          { label: university?.name_ko ?? "상세", href: `/admissions/${spec.university_id}` },
          { label: "모집요강" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={spec.status === "approved" ? "default" : "secondary"}>{STATUS_LABEL[spec.status] ?? spec.status}</Badge>
            <Link href={`/admissions/specs/${id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="size-4" />
              편집
            </Link>
            <AddTermButton specId={id} terms={terms.map((t) => ({ id: t.id, term: t.term }))} />
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
            <Info label="전형 이름" value={spec.admission_category} />
            <Info label="학기" value={terms.length ? terms.map((t) => t.term).join(" · ") : null} />
            <Info label="학과" value={`${departments.length} (어학당 ${departments.filter((d) => d.kind === "language").length} · 일반학과 ${departments.filter((d) => d.kind === "regular").length})`} />
            <Info label="발급서류 항목" value={String(docItemCount)} />
            <Info label="갱신" value={new Date(spec.updated_at).toLocaleString("ko-KR")} />
            {spec.approved_at ? <Info label="승인" value={new Date(spec.approved_at).toLocaleString("ko-KR")} /> : null}
            {spec.is_online_submission ? (
              <Info label="온라인 접수" value={spec.online_form_url ?? "온라인 접수 (주소 없음)"} full />
            ) : null}
          </dl>
        </Card>

        {/* 학과 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">학과 ({departments.length})</h2>
            <Link href={`/admissions/specs/${id}/edit?tab=departments`} className="text-xs text-primary underline">
              학과 편집
            </Link>
          </div>
          {departments.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">요강 학과가 없습니다.</Card>
          ) : (
            departments.map((d) => (
              <DepartmentCard
                key={d.id}
                sd={d}
                rows={rowsByDept.get(d.id) ?? []}
                files={filesByDept.get(d.id) ?? []}
                catalog={docCatalog}
                universityId={spec.university_id}
                offeringTerms={offerings.filter((o) => o.department_id === d.department_id).map((o) => o.term).sort((a, b) => b.localeCompare(a))}
                specEligibility={specEligibility}
                legacyLanguageProgram={metadata.language_program ?? null}
              />
            ))
          )}
        </section>

        {/* 옛 서류 줄 — 작성서류 · 미연결 */}
        {formDocs.length > 0 || unlinkedIssued.length > 0 ? (
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold">요강 원문 서류 줄 (작성서류 · 미연결)</h2>
            {formDocs.length > 0 ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">작성서류 (학교 양식) — {formDocs.length}</h3>
                <ul className="space-y-1 text-sm">
                  {formDocs.map((doc, i) => (
                    <li key={`form-${i}`} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{doc.name_ko}</span>
                      {doc.required === false ? <Badge variant="outline" className="text-[10px]">선택</Badge> : <Badge variant="secondary" className="text-[10px]">필수</Badge>}
                      {allCurrentFileKeys.has(doc.key) ? (
                        <Badge className="border-success/20 bg-success/10 text-success">등록됨</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600">미등록</Badge>
                      )}
                      {doc.notes ? <span className="w-full whitespace-pre-wrap text-xs text-muted-foreground">{doc.notes}</span> : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">양식은 학과 카드의 작성서류 양식에서 학과별로 올립니다.</p>
              </section>
            ) : null}
            {unlinkedIssued.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold">표준에 연결되지 않은 서류</h3>
                  <Badge variant="outline" className="text-[10px] text-amber-600">{unlinkedIssued.length}</Badge>
                  <Link href="/admissions?tab=docs" className="text-xs text-primary underline">
                    제출서류 탭에서 연결
                  </Link>
                </div>
                <ul className="space-y-1 text-sm">
                  {unlinkedIssued.map((doc, i) => (
                    <li key={`unlinked-${i}`} className="rounded-md border border-dashed px-3 py-2">
                      {doc.name_ko}
                      {doc.notes ? <span className="ml-2 text-xs text-muted-foreground">{doc.notes}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </Card>
        ) : null}

        {/* 학기 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">학기 ({terms.length})</h2>
            <Link href={`/admissions/specs/${id}/edit?tab=terms`} className="text-xs text-primary underline">
              학기 편집
            </Link>
          </div>
          {terms.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">학기가 없습니다. 위의 학기 추가로 만드세요.</Card>
          ) : (
            terms.map((t) => {
              const offs = offerings.filter((o) => o.term === t.term);
              return (
                <Card key={t.id} className="p-6 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{t.term}</h3>
                    <Badge variant="secondary">{offs.length} 학과 모집</Badge>
                    {t.notes ? <span className="text-xs text-muted-foreground">{t.notes}</span> : null}
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">일반학과 모집 일정</div>
                    <ScheduleTable schedule={(t.schedule ?? {}) as ScheduleShape} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">어학당 모집 일정</div>
                    <ScheduleTable schedule={(t.schedule_language ?? {}) as ScheduleShape} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">모집하는 학과</div>
                    {offs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">없음</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2 text-sm">
                        {offs.map((o) => {
                          const d = deptNameById.get(o.department_id);
                          return (
                            <li key={o.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1">
                              <span>{d?.name_ko ?? `학과 #${o.department_id}`}</span>
                              <Badge variant={o.status === "published" ? "default" : "outline"} className="text-[10px]">{OFFERING_STATUS_LABEL[o.status] ?? o.status}</Badge>
                              {o.intake_quota != null ? <span className="text-xs text-muted-foreground">{o.intake_quota}명</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </section>

        <MetadataCards metadata={metadata} />
      </div>
    </>
  );
}

// ── 학과 카드 ─────────────────────────────────────────────────────────

function DepartmentCard({
  sd,
  rows,
  files,
  catalog,
  universityId,
  offeringTerms,
  specEligibility,
  legacyLanguageProgram,
}: {
  sd: SpecDepartment;
  rows: SpecDocItemRow[];
  files: SpecFormFile[];
  catalog: DocCatalog;
  universityId: number;
  offeringTerms: string[];
  /** 옛 요강 공통 자격 — 학과 자격이 비었을 때 폴백 */
  specEligibility: EligibilityShape | null;
  /** 옛 metadata.language_program — 어학당 info.language_program 이 비었을 때 폴백 */
  legacyLanguageProgram: LanguageProgramShape | null;
}) {
  const itemByKey = new Map(catalog.items.map((i) => [i.key, i]));
  const tuition = sd.tuition as Tuition;
  const scholarships = sd.scholarships as Scholarship[];
  const ownEligibility = sd.eligibility && Object.keys(sd.eligibility).length ? (sd.eligibility as EligibilityShape) : null;
  const eligibility = ownEligibility ?? specEligibility;
  const hasValues = (o: object | null | undefined) => !!o && Object.values(o).some((v) => v !== undefined && v !== null && v !== "");
  const languageProgram: LanguageProgramShape | null =
    sd.kind === "language" ? ((hasValues(sd.info.language_program) ? sd.info.language_program : null) ?? (hasValues(legacyLanguageProgram) ? legacyLanguageProgram : null)) : null;
  const uploadHref = `/admissions/forms/new?university_id=${universityId}&spec_department_id=${encodeURIComponent(sd.id)}`;
  return (
    <Card className={`p-6 space-y-4 ${sd.is_active ? "" : "opacity-75"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{sd.name_ko}</h3>
        <Badge variant={sd.kind === "language" ? "default" : "secondary"}>{KIND_LABEL[sd.kind]}</Badge>
        {!sd.is_active ? <Badge variant="outline" className="text-muted-foreground">비활성</Badge> : null}
        {!sd.department_active ? <Badge variant="outline" className="text-amber-600">마스터 비노출</Badge> : null}
        {offeringTerms.length ? <span className="text-xs text-muted-foreground">모집: {offeringTerms.join(" · ")}</span> : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
        <Info label="학부" value={sd.info.faculty ?? null} />
        <Info label="트랙" value={sd.info.track ?? null} />
        <Info label="년수" value={sd.info.years != null ? String(sd.info.years) : null} />
        <Info label="정원" value={sd.info.capacity != null ? String(sd.info.capacity) : null} />
        <Info label="TOPIK 최소" value={sd.info.korean_min_topik ? `${sd.info.korean_min_topik}급` : null} />
        <Info label="학비" value={tuitionSummary(tuition)} />
        <Info label="장학금" value={scholarships.length ? `${scholarships.length}건 — ${scholarships.map((s) => s.name).filter(Boolean).slice(0, 3).join(", ")}${scholarships.length > 3 ? " 외" : ""}` : null} />
        {sd.info.notes ? <Info label="메모" value={sd.info.notes} full /> : null}
      </dl>

      {/* 어학연수 프로그램 — 어학당만 */}
      {sd.kind === "language" ? (
        <section className="rounded-md border p-3">
          <h4 className="mb-2 text-sm font-semibold">어학연수 프로그램</h4>
          {languageProgram ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <Info label="학기당 시간" value={languageProgram.hours_per_semester != null ? `${languageProgram.hours_per_semester}시간` : null} />
              <Info label="주당 시간" value={languageProgram.hours_per_week != null ? `${languageProgram.hours_per_week}시간` : null} />
              <Info label="학기 주수" value={languageProgram.weeks_per_semester != null ? `${languageProgram.weeks_per_semester}주` : null} />
              <Info label="주간 시간표" value={languageProgram.weekly_schedule} />
              <Info label="비자" value={languageProgram.visa_type} />
              <Info label="연장 비자" value={languageProgram.visa_extension} />
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">미입력</p>
          )}
        </section>
      ) : null}

      {/* 작성서류 양식 */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h4 className="text-sm font-semibold">작성서류 양식</h4>
          <Badge variant="secondary" className="text-[10px]">{files.length}</Badge>
          <Link href={uploadHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Upload className="size-3.5" />
            양식 업로드
          </Link>
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">이 학과의 양식이 없습니다.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{f.name_ko}</span>
                <span className="text-xs text-muted-foreground">{f.key}</span>
                {f.is_essay ? <Badge variant="outline" className="text-[10px]">서술형</Badge> : null}
                <Badge className="border-success/20 bg-success/10 text-success">등록됨</Badge>
                <span className="ml-auto flex items-center gap-1">
                  <Link href={`/admissions/forms/${f.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <Pencil className="size-3.5" />
                    편집
                  </Link>
                  <a href={f.file_url} target="_blank" rel="noreferrer" download className={buttonVariants({ variant: "ghost", size: "sm" })} title={f.file_name}>
                    <Download className="size-3.5" />
                  </a>
                  <DeleteFormFileButton formFileId={f.id} universityId={universityId} name={f.name_ko} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 발급서류 항목 */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h4 className="text-sm font-semibold">발급 서류 (항목)</h4>
          <Badge variant="secondary" className="text-[10px]">{rows.length}</Badge>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">고른 항목이 없습니다. 편집에서 항목을 추가하세요.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((r) => {
              const item = itemByKey.get(r.item_key);
              const slots = item ? expandItem(item, catalog) : [];
              const ov = r.overrides?.standards ?? {};
              const guide = r.guide_override_ko?.trim() || item?.guide_ko?.trim() || null;
              return (
                <li key={r.item_key} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {item?.name_ko ?? r.item_key}
                    {r.required === false ? <Badge variant="outline" className="text-[10px]">선택</Badge> : <Badge variant="secondary" className="text-[10px]">필수</Badge>}
                    {r.guide_override_ko || Object.keys(ov).length > 0 ? <Badge variant="outline" className="text-[10px] text-primary">따로 설정</Badge> : null}
                    {!item ? <Badge variant="outline" className="text-[10px] text-destructive">없는 항목</Badge> : null}
                  </div>
                  {slots.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {slots.map((sl, i) => {
                        const o = ov[sl.standard.key] ?? {};
                        const nota = o.notarization ?? sl.standard.notarization;
                        const validity = o.validity_days ?? sl.standard.validity_days;
                        const within = o.issued_within_days ?? sl.standard.issued_within_days;
                        const original = o.original_required ?? sl.standard.original_required;
                        const conds = [
                          nota && nota !== "none" ? `인증: ${NOTARIZATION_LABEL[nota] ?? nota}` : null,
                          validity != null ? `유효기간 ${validity}일` : null,
                          within != null ? `발급 후 ${within}일 이내` : null,
                          original === true ? "원본" : null,
                        ].filter(Boolean);
                        return (
                          <li key={i}>
                            {sl.standard.name_ko}
                            {sl.target ? ` - ${TARGET_LABEL_KO[sl.target] ?? sl.target}` : ""}
                            {sl.alternatives.length ? ` (또는 ${sl.alternatives.map((a) => a.name_ko).join(", ")})` : ""}
                            {!sl.required ? " · 선택" : ""}
                            {conds.length ? ` · ${conds.join(" · ")}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {guide ? <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{guide}</div> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 학비 · 장학금 상세 */}
      {tuition.tuition_by_faculty && Object.keys(tuition.tuition_by_faculty).length > 0 ? (
        <section>
          <h4 className="mb-2 text-sm font-semibold">학비 (계열별)</h4>
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
        </section>
      ) : null}
      {scholarships.length > 0 ? (
        <section>
          <h4 className="mb-2 text-sm font-semibold">장학금 ({scholarships.length})</h4>
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
                  <div className="text-right text-sm font-medium">{typeof s.benefit_value === "number" ? `${s.benefit_value.toLocaleString()}원` : s.benefit_value ?? "—"}</div>
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
        </section>
      ) : null}

      {/* 지원 자격 — 학과별 (비면 옛 요강 공통 폴백) */}
      <section className="rounded-md border p-3">
        <div className="mb-2 flex items-center gap-2">
          <h4 className="text-sm font-semibold">지원 자격</h4>
          {!ownEligibility && eligibility ? <Badge variant="outline" className="text-[10px] text-amber-600">옛 요강 공통 값</Badge> : null}
        </div>
        {eligibility ? <EligibilityBlock eligibility={eligibility} /> : <p className="text-xs text-muted-foreground">미입력</p>}
      </section>
    </Card>
  );
}

function tuitionSummary(t: Tuition): string | null {
  if (t.disclosure_state === "pending_until_acceptance" || t.unit === "pending") return "미정 (합격 후 안내)";
  if (t.tuition_per_semester) return `학기당 ${t.tuition_per_semester.toLocaleString()}원`;
  if (t.tuition_per_year) return `연 ${t.tuition_per_year.toLocaleString()}원`;
  if (t.tuition_by_faculty && Object.keys(t.tuition_by_faculty).length > 0) return `계열별 ${Object.keys(t.tuition_by_faculty).length}건`;
  return null;
}

// ── 일정 ──────────────────────────────────────────────────────────────

function ScheduleTable({ schedule }: { schedule: ScheduleShape }) {
  const empty = !(schedule.rounds && schedule.rounds.length > 0) && !schedule.semester_start && !schedule.orientation && !schedule.submission_method;
  if (empty) return <p className="text-sm text-muted-foreground">미입력</p>;
  return (
    <div>
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
                  <td className="px-3 py-2 text-xs">{r.interview_period ? `${r.interview_period[0]} ~ ${r.interview_period[1]}` : r.interview ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.result_announcement ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.payment_period ? `${r.payment_period[0]} ~ ${r.payment_period[1]}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">일정 없음</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {schedule.semester_start ? (
          <span>
            <span className="text-muted-foreground">개강: </span>
            <span className="font-medium">{schedule.semester_start}</span>
          </span>
        ) : null}
        {schedule.orientation ? (
          <span>
            <span className="text-muted-foreground">오리엔테이션: </span>
            <span className="font-medium">{schedule.orientation}</span>
          </span>
        ) : null}
        {schedule.submission_method ? (
          <span>
            <span className="text-muted-foreground">제출 방식: </span>
            <span className="font-medium">{schedule.submission_method}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── 자격 ──────────────────────────────────────────────────────────────

function EligibilityBlock({ eligibility }: { eligibility: EligibilityShape }) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">학력</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <Info label="요구 학력" value={eligibility.education_required ? EDUCATION_LABEL[eligibility.education_required] ?? eligibility.education_required : null} />
          <Info label="GPA 최소" value={eligibility.gpa_min != null ? `${eligibility.gpa_min}${eligibility.gpa_scale ? ` / ${eligibility.gpa_scale}` : ""}` : null} />
          <Info label="나이" value={formatAgeRequirement(eligibility.age_requirement)} />
          {eligibility.age_requirement?.notes ? <Info label="나이 메모" value={eligibility.age_requirement.notes} /> : null}
          {eligibility.applicant_categories && eligibility.applicant_categories.length > 0 ? <Info label="지원 카테고리" value={eligibility.applicant_categories.join(", ")} full /> : null}
          {eligibility.education_paths && eligibility.education_paths.length > 0 ? <Info label="허용 경로" value={eligibility.education_paths.join(", ")} full /> : null}
          {eligibility.education_exclusions && eligibility.education_exclusions.length > 0 ? <Info label="제외 학력" value={eligibility.education_exclusions.join(", ")} full /> : null}
        </dl>
      </section>

      {eligibility.korean_proficiency ? (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">한국어 능력</h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            <Info label="기본 TOPIK" value={eligibility.korean_proficiency.topik_min_default != null ? `${eligibility.korean_proficiency.topik_min_default}급 이상` : null} />
            <Info label="입학 후 요건" value={eligibility.korean_proficiency.post_admission_requirement ?? null} />
          </dl>
          {eligibility.korean_proficiency.alternative_paths && eligibility.korean_proficiency.alternative_paths.length > 0 ? (
            <div className="mt-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">TOPIK 대체 경로</div>
              <ul className="mt-1 space-y-1 text-sm">
                {eligibility.korean_proficiency.alternative_paths.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">{p.type ? ALT_PATH_LABEL[p.type] ?? p.type : "—"}</Badge>
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

      {eligibility.english_proficiency && (eligibility.english_proficiency.minimums || eligibility.english_proficiency.applies_to_departments) ? (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">영어 능력</h3>
          {eligibility.english_proficiency.applies_to_departments && eligibility.english_proficiency.applies_to_departments.length > 0 ? (
            <div className="text-sm">
              <span className="text-muted-foreground">대상: </span>
              {eligibility.english_proficiency.applies_to_departments.join(", ")}
            </div>
          ) : null}
          {eligibility.english_proficiency.minimums ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(eligibility.english_proficiency.minimums).map(([k, v]) => (
                <Badge key={k} variant="outline">
                  {k}: {String(v)}
                </Badge>
              ))}
            </div>
          ) : null}
          {eligibility.english_proficiency.notes ? <p className="mt-1 text-xs text-muted-foreground">{eligibility.english_proficiency.notes}</p> : null}
        </section>
      ) : null}

      {eligibility.financial_minimum ? (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">재정</h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            <Info label="최소 금액" value={eligibility.financial_minimum.amount != null ? `${eligibility.financial_minimum.amount.toLocaleString()} ${eligibility.financial_minimum.currency ?? "KRW"}` : null} />
            <Info label="유효 기간" value={eligibility.financial_minimum.freshness_days != null ? `${eligibility.financial_minimum.freshness_days}일` : null} />
            {eligibility.financial_minimum.holder_relations && eligibility.financial_minimum.holder_relations.length > 0 ? (
              <Info label="예금주" value={eligibility.financial_minimum.holder_relations.map((h) => HOLDER_LABEL[h] ?? h).join(", ")} full />
            ) : null}
            {eligibility.financial_minimum.notes ? <Info label="재정 메모" value={eligibility.financial_minimum.notes} full /> : null}
          </dl>
        </section>
      ) : null}

      {(eligibility.exclusions && eligibility.exclusions.length > 0) || eligibility.notes_ko ? (
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
          {eligibility.notes_ko ? <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{eligibility.notes_ko}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

// ── 기타(metadata) ────────────────────────────────────────────────────

function MetadataCards({ metadata }: { metadata: MetadataShape }) {
  const hasValues = (o: object | undefined) => !!o && Object.values(o).some((v) => v !== undefined && v !== null && v !== "");
  return (
    <>
      {hasValues(metadata.selection_process) ? (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">선발 절차</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            <Info label="선발 방법" value={metadata.selection_process!.method} />
            <Info label="면접" value={metadata.selection_process!.interview_required ? "필수" : "없음"} />
            {metadata.selection_process!.interview_content && metadata.selection_process!.interview_content.length > 0 ? (
              <Info label="면접 내용" value={metadata.selection_process!.interview_content.join(", ")} full />
            ) : null}
            <Info label="평가 기준" value={metadata.selection_process!.evaluation_criteria} full />
          </dl>
        </Card>
      ) : null}

      {hasValues(metadata.contacts) ? (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">연락처</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            <Info label="담당 부서" value={metadata.contacts!.department_name} />
            <Info label="전화" value={metadata.contacts!.phone} />
            <Info label="베트남어 응대" value={metadata.contacts!.phone_vietnamese} />
            <Info label="한국어 응대" value={metadata.contacts!.phone_korean} />
            <Info label="이메일" value={metadata.contacts!.email ?? null} />
            <Info label="보조 이메일" value={metadata.contacts!.email_secondary} />
            <Info label="팩스" value={metadata.contacts!.fax} />
            <Info label="접수 시간" value={metadata.contacts!.submission_hours} />
            <Info label="웹사이트" value={metadata.contacts!.website} full />
            <Info label="온라인 지원 URL" value={metadata.contacts!.online_apply_url} full />
            <Info label="주소 (한국어)" value={metadata.contacts!.address_ko} full />
            <Info label="주소 (영어)" value={metadata.contacts!.address_en} full />
          </dl>
        </Card>
      ) : null}

      {metadata.government_designations && metadata.government_designations.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">정부 지정</h2>
          <ul className="space-y-2 text-sm">
            {metadata.government_designations.map((g, i) => (
              <li key={i} className="rounded-md border border-success/30 bg-success/5 p-3">
                <div className="font-medium">
                  {g.designation_name ?? "—"}
                  {g.effective_from ? <span className="ml-2 text-xs text-muted-foreground">(시행: {g.effective_from})</span> : null}
                </div>
                {g.benefits && g.benefits.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.benefits.map((b, j) => (
                      <Badge key={j} variant="outline" className="text-xs">{BENEFIT_LABEL[b] ?? b}</Badge>
                    ))}
                  </div>
                ) : null}
                {g.notes ? <p className="mt-1 text-xs text-muted-foreground">{g.notes}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {metadata.country_specific_notes_vi ? (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">베트남 특화 안내</h2>
          <p className="whitespace-pre-wrap text-sm">{metadata.country_specific_notes_vi}</p>
        </Card>
      ) : null}
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
