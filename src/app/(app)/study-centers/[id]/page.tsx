import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StudyCenterForm } from "@/components/study-center-form";
import type { StudyCenterInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function StudyCenterEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("study_centers")
    .select("*")
    .eq("id", numericId)
    .single();

  if (error || !row) notFound();

  const defaultValues: Partial<StudyCenterInput> = {
    active: row.active,
    flag: row.flag,
    name_ko: row.name_ko,
    name_vi: row.name_vi,
    city_ko: row.city_ko,
    city_vi: row.city_vi,
    address: row.address,
    phone: row.phone,
    email: row.email,
    desc_ko: row.desc_ko,
    desc_vi: row.desc_vi,
    students_ko: row.students_ko,
    students_vi: row.students_vi,
    years_ko: row.years_ko,
    years_vi: row.years_vi,
  };

  return (
    <>
      <PageHeader
        title={`${row.flag ?? "🇻🇳"} ${row.name_vi}`}
        description={`센터 #${numericId}`}
        breadcrumbs={[
          { href: "/study-centers", label: "유학센터" },
          { label: row.name_vi },
        ]}
      />
      <div className="p-6">
        <StudyCenterForm
          mode="edit"
          centerId={numericId}
          defaultValues={defaultValues}
        />
      </div>
    </>
  );
}
