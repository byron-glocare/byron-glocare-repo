import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DepartmentForm } from "@/components/department-form";
import { getDepartmentSpecFill } from "@/lib/admission/spec-fill";
import type { DepartmentInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function DepartmentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const [{ data: row, error }, { data: universities }] = await Promise.all([
    supabase.from("departments").select("*").eq("id", numericId).single(),
    supabase.from("universities").select("id, name_ko, emoji").order("id"),
  ]);

  if (error || !row || !universities) notFound();

  // 이 학과의 대학에 승인된 모집요강이 있으면, 폼에 채울 값을 미리 계산
  const specFill = await getDepartmentSpecFill(row.university_id, row.name_ko);

  const defaultValues: Partial<DepartmentInput> = {
    university_id: row.university_id,
    active: row.active,
    icon: row.icon,
    name_ko: row.name_ko,
    name_vi: row.name_vi,
    category: row.category,
    degree_years: row.degree_years,
    tuition_ko: row.tuition_ko,
    tuition_vi: row.tuition_vi,
    scholarship_ko: row.scholarship_ko,
    scholarship_vi: row.scholarship_vi,
    dept_url: row.dept_url,
    badge: row.badge,
    case_ids: row.case_ids,
    course: row.course,
    study_period: row.study_period,
    sort_order: row.sort_order,
  };

  return (
    <>
      <PageHeader
        title={`${row.icon ?? "📚"} ${row.name_ko}`}
        description={`학과 #${numericId}`}
        breadcrumbs={[
          { href: "/departments", label: "학과" },
          { label: row.name_ko },
        ]}
      />
      <div className="p-6">
        <DepartmentForm
          mode="edit"
          deptId={numericId}
          defaultValues={defaultValues}
          universityOptions={universities}
          backHref={`/universities/${row.university_id}`}
          specFill={specFill}
        />
      </div>
    </>
  );
}
