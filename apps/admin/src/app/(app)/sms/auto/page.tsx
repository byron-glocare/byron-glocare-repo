import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { AutoSmsView } from "@/components/sms/auto-sms-view";

export const dynamic = "force-dynamic";

/**
 * 자동 문자 — 교육생 생애주기 날짜 기준으로 자동 발송되는 문자 룰 관리.
 * 발송 엔진은 /api/cron/auto-sms (pg_cron 이 10분마다 호출).
 */
export default async function AutoSmsPage() {
  const supabase = await createClient();

  const [{ data: rules }, { data: statRows }, { data: recentRows }] =
    await Promise.all([
      supabase
        .from("auto_sms_rules")
        .select(
          "id, name, title, anchor_field, offset_days, send_time, body, image_path, is_active, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase.from("auto_sms_sends").select("rule_id, status"),
      supabase
        .from("auto_sms_sends")
        .select(
          "id, status, error, sent_at, due_at, auto_sms_rules(name), customers(code, name_kr, name_vi)"
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  // 룰별 발송/실패 집계
  const stats = new Map<string, { sent: number; failed: number }>();
  for (const r of statRows ?? []) {
    const s = stats.get(r.rule_id) ?? { sent: 0, failed: 0 };
    if (r.status === "sent") s.sent += 1;
    else if (r.status === "failed") s.failed += 1;
    stats.set(r.rule_id, s);
  }

  const ruleRows = (rules ?? []).map((r) => ({
    ...r,
    imageUrl: r.image_path
      ? supabase.storage.from("sms-images").getPublicUrl(r.image_path).data
          .publicUrl
      : null,
    sentCount: stats.get(r.id)?.sent ?? 0,
    failedCount: stats.get(r.id)?.failed ?? 0,
  }));

  const recent = (recentRows ?? []).map((s) => {
    const rule = s.auto_sms_rules as { name: string } | null;
    const c = s.customers as {
      code: string | null;
      name_kr: string | null;
      name_vi: string | null;
    } | null;
    return {
      id: s.id,
      ruleName: rule?.name ?? "(삭제된 룰)",
      customer: c ? `${c.code ?? "?"} · ${c.name_kr || c.name_vi || "?"}` : "?",
      status: s.status,
      error: s.error,
      sentAt: s.sent_at ? formatDateTime(s.sent_at) : "—",
    };
  });

  return (
    <>
      <PageHeader
        title="자동 문자"
        description="교육생 생애주기(가입·교육·취업 등) 날짜 기준으로 자동 발송되는 문자 관리"
        breadcrumbs={[{ label: "알림발송", href: "/sms" }, { label: "자동 문자" }]}
      />
      <div className="p-6">
        <AutoSmsView rules={ruleRows} recent={recent} />
      </div>
    </>
  );
}
