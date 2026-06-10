/**
 * /center/students/[id]/applications/new
 *   학생에게 신규 지원 의향(study_applications) 등록.
 *   approved 모집요강 list 를 dropdown 으로 노출.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyCenterSession } from "@/lib/center/dal";
import { createCenterClient } from "@/lib/supabase/center";
import { getLocale, tr } from "@/lib/i18n";

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
  const [{ data: specs }, { data: offerings }] = await Promise.all([
    supabase
      .from("study_admission_specs")
      .select(
        "id, university_id, term, admission_category, program_type, departments"
      )
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
    supabase
      .from("study_offerings")
      .select(
        "id, university_id, department_id, term, intake_quota, available_languages, location_options, source_spec_id, sort_order"
      )
      .eq("status", "published")
      .not("source_spec_id", "is", null)
      .order("term", { ascending: false }),
  ]);

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
          .select("id, name_ko")
          .in("id", universityIds)
      : { data: [] as Array<{ id: number; name_ko: string }> };

  const universityMap = new Map(
    (universities ?? []).map((u) => [u.id, u.name_ko])
  );

  // offering 학과명 join
  const offeringDeptIds = Array.from(
    new Set((offerings ?? []).map((o) => o.department_id))
  );
  const { data: offeringDepts } =
    offeringDeptIds.length > 0
      ? await supabase
          .from("departments")
          .select("id, name_ko")
          .in("id", offeringDeptIds)
      : { data: [] as Array<{ id: number; name_ko: string }> };
  const deptMap = new Map((offeringDepts ?? []).map((d) => [d.id, d.name_ko]));

  const offeringOptions: OfferingOption[] = (offerings ?? [])
    .filter((o) => o.source_spec_id) // 지원 가능 = 모집요강 연결 (admission_spec_id NOT NULL 충족)
    .map((o) => ({
      id: o.id,
      sourceSpecId: o.source_spec_id as string,
      universityNameKo: universityMap.get(o.university_id) ?? null,
      departmentId: o.department_id,
      departmentNameKo: deptMap.get(o.department_id) ?? `학과 #${o.department_id}`,
      term: o.term,
      intakeQuota: o.intake_quota,
      availableLanguages: (o.available_languages ?? []) as string[],
      locationOptions: (o.location_options ?? []) as string[],
    }));

  const specOptions: SpecOption[] = (specs ?? []).map((s) => {
    const depts = Array.isArray(s.departments)
      ? (s.departments as Array<{
          name?: string;
          faculty?: string | null;
          track?: string | null;
        }>)
      : [];
    return {
      id: s.id,
      universityNameKo: universityMap.get(s.university_id) ?? null,
      term: s.term,
      admissionCategory: s.admission_category,
      programType: s.program_type,
      departments: depts
        .filter((d) => d && typeof d === "object" && typeof d.name === "string")
        .map((d) => ({
          name: d.name as string,
          faculty: d.faculty ?? null,
          track: d.track ?? null,
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
          studentName={student.name}
          specs={specOptions}
          offerings={offeringOptions}
        />
      </div>
    </div>
  );
}
