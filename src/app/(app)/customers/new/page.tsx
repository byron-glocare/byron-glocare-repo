import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CustomerBasicForm } from "@/components/customer-basic-form";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const supabase = await createClient();

  const [{ data: centers }, { data: classes }, { data: homes }] =
    await Promise.all([
      supabase
        .from("training_centers")
        .select("id, code, name, region")
        .order("name"),
      supabase
        .from("training_classes")
        .select(
          "id, training_center_id, year, month, class_type, start_date, end_date"
        )
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
      supabase
        .from("care_homes")
        .select("id, code, name, region")
        .order("name"),
    ]);

  return (
    <>
      <PageHeader
        title="신규 고객 등록"
        description="저장하면 CVN + YYMM + 순번 3자리 형식의 코드가 자동 발급됩니다."
        breadcrumbs={[
          { href: "/customers", label: "고객관리" },
          { label: "등록" },
        ]}
      />
      <div className="p-6">
        <CustomerBasicForm
          mode="create"
          trainingCenters={centers ?? []}
          trainingClasses={classes ?? []}
          careHomes={homes ?? []}
        />
      </div>
    </>
  );
}
