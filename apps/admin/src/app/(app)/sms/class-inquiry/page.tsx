import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SmsClassInquiryView } from "@/components/sms/sms-class-inquiry-view";

export const dynamic = "force-dynamic";

export default async function SmsClassInquiryPage() {
  const supabase = await createClient();

  const [{ data: centers }, { data: inquiries }, { data: classes }] =
    await Promise.all([
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
      supabase
        .from("training_classes")
        .select("training_center_id, start_date, year, month"),
    ]);

  // 교육원별 최근 문의 발송 시각 (내림차순 조회라 첫 등장이 최신)
  const lastSentByCenter = new Map<string, string>();
  for (const m of inquiries ?? []) {
    if (m.target_center_id && !lastSentByCenter.has(m.target_center_id)) {
      lastSentByCenter.set(m.target_center_id, m.sent_at);
    }
  }

  // 교육원별 마지막(가장 늦은) 등록 강의 날짜.
  // start_date 가 없으면 year/month 로 그 달 1일 취급 (표시는 "N년 M월").
  const lastClassByCenter = new Map<string, { iso: string; label: string }>();
  for (const cl of classes ?? []) {
    const iso =
      cl.start_date ?? `${cl.year}-${String(cl.month).padStart(2, "0")}-01`;
    const prev = lastClassByCenter.get(cl.training_center_id);
    if (!prev || iso > prev.iso) {
      const [y, m, d] = iso.split("-");
      const label = cl.start_date
        ? `${Number(y)}년 ${Number(m)}월 ${Number(d)}일`
        : `${Number(y)}년 ${Number(m)}월`;
      lastClassByCenter.set(cl.training_center_id, { iso, label });
    }
  }

  const rows = (centers ?? []).map((c) => ({
    ...c,
    lastSentAt: lastSentByCenter.get(c.id) ?? null,
    lastClassIso: lastClassByCenter.get(c.id)?.iso ?? null,
    lastClassLabel: lastClassByCenter.get(c.id)?.label ?? null,
  }));

  // 마지막 강의가 오래된(또는 아예 없는) 교육원이 위로 — 문의가 급한 순서
  rows.sort((a, b) => {
    if (!a.lastClassIso && !b.lastClassIso)
      return a.name.localeCompare(b.name, "ko");
    if (!a.lastClassIso) return -1;
    if (!b.lastClassIso) return 1;
    return (
      a.lastClassIso.localeCompare(b.lastClassIso) ||
      a.name.localeCompare(b.name, "ko")
    );
  });

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
