/**
 * /center/students/[id]/applications/new
 *   학생에게 신규 지원 의향(study_applications) 등록.
 *   기본은 모집 중(published) offering = 대학 × 학과 × 학기. 모집요강에서 직접 고르는 길도 남긴다
 *   (0067: 요강은 대학당 1개, 학과는 study_spec_departments, 학기는 study_spec_terms).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";

import { deriveOfferingLanguages } from "@/lib/admission/offering-languages";
import {
  departmentEligibility,
  loadSpecDepartments,
  loadSpecTerms,
} from "@/lib/admission/spec-documents";

import {
  NewApplicationForm,
  type SpecOption,
  type OfferingOption,
} from "./new-application-form";

export default async function NewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyCenterSession();
  const locale = await getLocale();
  const supabase = await createCenterClient();

  // 1. 학생 존재·소유 확인 (RLS)
  const { data: student } = await supabase
    .from("study_managed_students")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!student) {
    notFound();
  }

  // 2. approved 모집요강 list + 모집 중 offering (지원 가능 = 모집요강 연결된 것)
  const [{ data: specs }, { data: offerings }, { data: myApps }] = await Promise.all([
    supabase
      .from("study_admission_specs")
      .select("id, university_id, term, admission_category, eligibility")
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
    supabase
      .from("study_offerings")
      .select(
        "id, university_id, department_id, term, intake_quota, total_quota, source_spec_id, sort_order"
      )
      .eq("status", "published")
      .not("source_spec_id", "is", null)
      .order("term", { ascending: false }),
    // 0069: 이 학생의 기존 지원 — 학기별 남은 지망 수·이미 지원한 모집 표시
    supabase
      .from("study_applications")
      .select("id, offering_id, term, status")
      .eq("student_id", id),
  ]);

  const existingByTerm: Record<string, { count: number; offeringIds: string[] }> = {};
  for (const a of myApps ?? []) {
    if (a.status === "cancelled" || !a.term) continue;
    const e = (existingByTerm[a.term] ??= { count: 0, offeringIds: [] });
    e.count += 1;
    if (a.offering_id) e.offeringIds.push(a.offering_id);
  }

  const specById = new Map((specs ?? []).map((s) => [s.id, s]));
  const specIds = (specs ?? []).map((s) => s.id);
  // 요강의 학과(어학당 포함)·학기 — 언어 도출(학과 자격요건 → 요강 공통)과 직접 선택 옵션에 쓴다
  const [deptsBySpec, termsBySpec] = await Promise.all([
    loadSpecDepartments(supabase, specIds),
    loadSpecTerms(supabase, specIds),
  ]);
  const specDeptOf = (specId: string | null | undefined, departmentId: number) =>
    specId ? (deptsBySpec.get(specId) ?? []).find((d) => d.department_id === departmentId) ?? null : null;

  // 3. universities 이름 join (지금 schema 의 FK 가 number 라 별도 query)
  const universityIds = Array.from(
    new Set([
      ...(specs ?? []).map((s) => s.university_id),
      ...(offerings ?? []).map((o) => o.university_id),
    ])
  );
  const { data: universities } =
    universityIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko, name_vi")
          .in("id", universityIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };

  const universityMap = new Map(
    (universities ?? []).map((u) => [u.id, u.name_ko])
  );
  // 화면 표시용 — 베트남어 화면이면 name_vi, 비어 있으면 한국어로 폴백.
  // (어드민 대학 편집에 '대학명 (VN)' 입력칸이 이미 있다)
  const universityDisplayMap = new Map(
    (universities ?? []).map((u) => [
      u.id,
      locale === "vi" ? (u.name_vi || u.name_ko) : u.name_ko,
    ])
  );

  // offering 학과명 join
  const offeringDeptIds = Array.from(
    new Set((offerings ?? []).map((o) => o.department_id))
  );
  const { data: offeringDepts } =
    offeringDeptIds.length > 0
      ? await supabase
          .from("departments")
          .select("id, name_ko, name_vi")
          .in("id", offeringDeptIds)
      : { data: [] as Array<{ id: number; name_ko: string; name_vi: string | null }> };
  // 한국어 학과명 — 저장값(target_department_label)과 언어 도출에 쓴다.
  //   옛 코드가 한국어 department_name 과 비교하므로 절대 번역하면 안 된다.
  const deptMap = new Map((offeringDepts ?? []).map((d) => [d.id, d.name_ko]));
  // 화면 표시용 학과명 (어드민 학과 편집의 '학과명 (VN)')
  const deptDisplayMap = new Map(
    (offeringDepts ?? []).map((d) => [
      d.id,
      locale === "vi" ? (d.name_vi || d.name_ko) : d.name_ko,
    ])
  );

  const offeringOptions: OfferingOption[] = (offerings ?? [])
    .filter((o) => o.source_spec_id) // 지원 가능 = 모집요강 연결 (admission_spec_id NOT NULL 충족)
    .map((o) => {
      const specDept = specDeptOf(o.source_spec_id, o.department_id);
      const deptName = deptMap.get(o.department_id) ?? specDept?.name_ko ?? `학과 #${o.department_id}`;
      const spec = o.source_spec_id ? specById.get(o.source_spec_id) : null;
      return {
        id: o.id,
        sourceSpecId: o.source_spec_id as string,
        universityNameKo: universityMap.get(o.university_id) ?? null,
        universityName: universityDisplayMap.get(o.university_id) ?? null,
        departmentId: o.department_id,
        departmentNameKo: deptName,
        departmentName: deptDisplayMap.get(o.department_id) ?? deptName,
        term: o.term,
        intakeQuota: o.intake_quota,
        totalQuota: o.total_quota ?? null,
        sortOrder: o.sort_order,
        // 언어는 자격요건에서 도출 — 학과에 따로 있으면 그것, 없으면 요강 공통
        availableLanguages: deriveOfferingLanguages(
          departmentEligibility(specDept, spec ?? null),
          deptName
        ),
      };
    });

  const specOptions: SpecOption[] = (specs ?? []).map((s) => {
    const depts = deptsBySpec.get(s.id) ?? [];
    const terms = (termsBySpec.get(s.id) ?? []).map((t) => t.term);
    return {
      id: s.id,
      universityNameKo: universityMap.get(s.university_id) ?? null,
      universityName: universityDisplayMap.get(s.university_id) ?? null,
      admissionCategory: s.admission_category,
      terms: terms.length > 0 ? terms : s.term ? [s.term] : [],
      departments: depts.map((d) => ({
        departmentId: d.department_id,
        nameKo: d.name_ko,
        name: locale === "vi" ? d.name_vi || d.name_ko : d.name_ko,
        kind: d.kind,
        availableLanguages: deriveOfferingLanguages(departmentEligibility(d, s), d.name_ko),
      })),
    };
  });

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <Link
          href={`/center/students/${id}`}
          className="text-sm text-slate-500 hover:underline"
        >
          {tr(locale, "← 상세로 돌아가기", "← Quay lại chi tiết")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {tr(locale, "신규 지원 등록", "Đăng ký nguyện vọng mới")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {tr(locale, "학생", "Sinh viên")}: <strong>{student.name}</strong>
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <NewApplicationForm
          locale={locale}
          studentId={id}
          specs={specOptions}
          offerings={offeringOptions}
          existingByTerm={existingByTerm}
        />
      </div>
    </div>
  );
}
