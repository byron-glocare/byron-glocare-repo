import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StudyCaseForm } from "@/components/study-case-form";
import type { StudyCaseInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function StudyCaseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("study_cases")
    .select("*")
    .eq("id", numericId)
    .single();

  if (error || !row) notFound();

  const defaultValues: Partial<StudyCaseInput> = {
    active: row.active,
    tiktok_url: row.tiktok_url,
    tiktok_thumb: row.tiktok_thumb,
    hero: row.hero,
    category_ko: row.category_ko,
    category_vi: row.category_vi,
    title_ko: row.title_ko,
    title_vi: row.title_vi,
    desc_ko: row.desc_ko,
    desc_vi: row.desc_vi,
  };

  const titleLabel =
    row.title_ko ?? row.title_vi ?? `#${numericId}`;

  return (
    <>
      <PageHeader
        title={titleLabel}
        description={`사례 #${numericId}`}
        breadcrumbs={[
          { href: "/study-cases", label: "사례" },
          { label: titleLabel },
        ]}
      />
      <div className="p-6">
        <StudyCaseForm
          mode="edit"
          caseId={numericId}
          defaultValues={defaultValues}
        />
      </div>
    </>
  );
}
