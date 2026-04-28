import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DepartmentForm } from "@/components/department-form";

export const dynamic = "force-dynamic";

export default async function NewDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ university_id?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: universities } = await supabase
    .from("universities")
    .select("id, name_ko, emoji")
    .eq("active", true)
    .order("id");

  if (!universities || universities.length === 0) {
    notFound();
  }

  const preselectedId = sp.university_id ? Number(sp.university_id) : null;
  const backHref = preselectedId
    ? `/universities/${preselectedId}`
    : "/departments";

  return (
    <>
      <PageHeader
        title="학과 등록"
        breadcrumbs={[
          { href: "/departments", label: "학과" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <DepartmentForm
          mode="create"
          universityOptions={universities}
          defaultValues={
            preselectedId ? { university_id: preselectedId } : undefined
          }
          backHref={backHref}
        />
      </div>
    </>
  );
}
