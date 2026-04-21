import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SmsNewStudentView } from "@/components/sms-new-student-view";

export const dynamic = "force-dynamic";

export default async function SmsNewStudentPage() {
  const supabase = await createClient();

  // 1. 교육원 + 전화번호 로드
  const { data: centers } = await supabase
    .from("training_centers")
    .select("id, name, region, director_name, phone");

  // 2. 매칭된 교육생 (모든 단계)
  const { data: customers } = await supabase
    .from("customers")
    .select(
      "id, code, name_kr, name_vi, phone, visa_type, birth_year, training_center_id, training_class_id, class_start_date"
    )
    .not("training_center_id", "is", null);

  // 3. training_classes — class_type 알아야 함
  const { data: classes } = await supabase
    .from("training_classes")
    .select("id, training_center_id, year, month, class_type, start_date");

  // 4. 이미 new_student SMS 발송된 고객 id
  const { data: sentMessages } = await supabase
    .from("sms_messages")
    .select("target_customer_id")
    .eq("message_type", "new_student")
    .not("target_customer_id", "is", null);

  const sentCustomerIds = new Set(
    (sentMessages ?? [])
      .map((m) => m.target_customer_id)
      .filter((v): v is string => !!v)
  );

  return (
    <>
      <PageHeader
        title="신규 교육생 알림"
        description="교육원별로 미발송 교육생을 묶어 원장에게 SMS를 발송합니다."
        breadcrumbs={[
          { href: "/sms", label: "알림발송" },
          { label: "신규 교육생" },
        ]}
      />
      <div className="p-6">
        <SmsNewStudentView
          centers={centers ?? []}
          customers={customers ?? []}
          classes={classes ?? []}
          sentCustomerIds={Array.from(sentCustomerIds)}
        />
      </div>
    </>
  );
}
