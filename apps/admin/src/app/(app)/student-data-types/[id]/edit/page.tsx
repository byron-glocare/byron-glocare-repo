import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  DataTypeForm,
  type DataTypeRef,
  type EditableDataType,
} from "../../type-form";

export const dynamic = "force-dynamic";

export default async function EditDataTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("study_student_data_types")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!t) notFound();

  // 선택자·원본 후보용 전체 타입 목록
  const { data: allRows } = await supabase
    .from("study_student_data_types")
    .select("id, key, label_ko, input_type, options")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  const allTypes: DataTypeRef[] = (allRows ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label_ko: r.label_ko,
    input_type: r.input_type,
    options: r.options,
  }));

  const editable: EditableDataType = {
    id: t.id,
    key: t.key,
    label_ko: t.label_ko,
    label_vi: t.label_vi,
    category: t.category,
    input_type: t.input_type,
    options: t.options,
    hint_ko: t.hint_ko,
    hint_vi: t.hint_vi,
    is_essay_basis: t.is_essay_basis,
    is_default_required: t.is_default_required,
    sort_order: t.sort_order,
    is_active: t.is_active,
    scope: t.scope,
    aliases: t.aliases ?? [],
  };

  return (
    <>
      <PageHeader
        title="데이터 타입 편집"
        description={`${t.label_ko} (${t.key})`}
        breadcrumbs={[
          { label: "표준 데이터", href: "/student-data-types" },
          { label: t.label_ko },
        ]}
      />
      <div className="p-6">
        <DataTypeForm dataType={editable} allTypes={allTypes} />
      </div>
    </>
  );
}
