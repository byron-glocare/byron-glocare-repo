import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTypeForm, type DataTypeRef } from "../type-form";

export const dynamic = "force-dynamic";

export default async function NewDataTypePage() {
  const supabase = await createClient();
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

  return (
    <>
      <PageHeader
        title="데이터 타입 추가"
        description="새로운 표준 정보 항목 정의"
        breadcrumbs={[
          { label: "표준 데이터", href: "/student-data-types" },
          { label: "신규" },
        ]}
      />
      <div className="p-6">
        <DataTypeForm allTypes={allTypes} />
      </div>
    </>
  );
}
