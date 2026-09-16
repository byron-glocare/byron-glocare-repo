/**
 * /admissions/forms/new — 작성서류(양식파일) 신규 업로드.
 *   대학·요강 학과·양식종류 선택 후 파일 업로드 → AI 분석(uploadFormFileAction) → 목록으로.
 *   양식은 요강 학과(study_spec_departments)에 속한다 — 버전 묶음 = (대학, 종류, 요강 학과).
 */

import { redirect } from "next/navigation";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { NewFormDoc, type SpecDeptOption } from "./new-form-doc";

export const dynamic = "force-dynamic";

export default async function NewFormDocPage({
  searchParams,
}: {
  searchParams: Promise<{
    university_id?: string;
    spec_department_id?: string;
    key?: string;
    name_ko?: string;
  }>;
}) {
  const sp = await searchParams;
  const preUni = sp.university_id ?? "";
  // 모집요강 편집의 [양식 업로드] 에서 넘어오면 어느 학과·서류의 양식인지 함께 온다.
  const preSpecDept = sp.spec_department_id ?? "";
  const preKey = sp.key ?? "";
  const preName = sp.name_ko ?? "";

  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) redirect("/login?redirect=/admissions/forms/new");

  const supabase = createAdminClient();
  const [{ data: universities }, { data: departments }, { data: specs }, { data: specDepts }] = await Promise.all([
    supabase.from("universities").select("id, name_ko").order("name_ko"),
    supabase.from("departments").select("id, university_id, name_ko, active").order("sort_order"),
    supabase.from("study_admission_specs").select("id, university_id").neq("status", "archived"),
    supabase
      .from("study_spec_departments")
      .select("id, spec_id, department_id, kind, is_active, sort_order")
      .order("sort_order"),
  ]);

  const uniBySpec = new Map((specs ?? []).map((s) => [s.id, s.university_id]));
  const deptById = new Map((departments ?? []).map((d) => [d.id, d]));
  const specDeptOptions: SpecDeptOption[] = (specDepts ?? [])
    .filter((sd) => uniBySpec.has(sd.spec_id))
    .map((sd) => ({
      id: sd.id,
      university_id: uniBySpec.get(sd.spec_id)!,
      name_ko: deptById.get(sd.department_id)?.name_ko ?? `학과 #${sd.department_id}`,
      kind: sd.kind,
      is_active: sd.is_active,
      sort_order: sd.sort_order,
    }))
    .sort((a, b) => (a.kind === b.kind ? a.sort_order - b.sort_order : a.kind === "language" ? -1 : 1));

  return (
    <>
      <PageHeader
        title="작성서류 추가"
        description="양식파일 업로드 → AI가 필요 표준데이터를 정리합니다"
        breadcrumbs={[
          { href: "/admissions", label: "입학서류" },
          { label: "작성서류 추가" },
        ]}
      />
      <div className="p-6">
        <NewFormDoc
          universities={universities ?? []}
          specDepartments={specDeptOptions}
          preUniversityId={preUni}
          preSpecDepartmentId={preSpecDept}
          preKey={preKey}
          preName={preName}
        />
      </div>
    </>
  );
}
