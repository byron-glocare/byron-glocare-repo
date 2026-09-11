import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SmsClassInquiryView } from "@/components/sms/sms-class-inquiry-view";

export const dynamic = "force-dynamic";

export default async function SmsClassInquiryPage() {
  const supabase = await createClient();

  const [{ data: centers }, { data: inquiries }] = await Promise.all([
    supabase
      .from("training_centers")
      .select(
        "id, name, region, phone, director_phone, contact_phone, sms_recipient"
      )
      .eq("partnership_terminated", false)
      .order("name"),
    supabase
      .from("sms_messages")
      .select("target_center_id, sent_at")
      .eq("message_type", "class_inquiry")
      .not("target_center_id", "is", null)
      .order("sent_at", { ascending: false })
      .limit(500),
  ]);

  // 교육원별 최근 문의 발송 시각 (내림차순 조회라 첫 등장이 최신)
  const lastSentByCenter = new Map<string, string>();
  for (const m of inquiries ?? []) {
    if (m.target_center_id && !lastSentByCenter.has(m.target_center_id)) {
      lastSentByCenter.set(m.target_center_id, m.sent_at);
    }
  }

  const rows = (centers ?? []).map((c) => ({
    ...c,
    lastSentAt: lastSentByCenter.get(c.id) ?? null,
  }));

  return (
    <>
      <PageHeader
        title="강의 정보 문의"
        description="제휴중 교육원에 이번 달/다음 달 개강 일정(주·야간, 시작일) 확인 문자를 발송합니다. 문구는 5종 중 랜덤."
        breadcrumbs={[
          { href: "/sms", label: "알림발송" },
          { label: "강의 정보 문의" },
        ]}
      />
      <div className="p-6">
        <SmsClassInquiryView centers={rows} />
      </div>
    </>
  );
}
