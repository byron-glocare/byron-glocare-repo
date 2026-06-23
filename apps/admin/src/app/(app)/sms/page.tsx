import Link from "next/link";
import { ArrowRight, Clock, GraduationCap, Receipt } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { SmsHistoryView } from "@/components/sms/sms-history-view";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const supabase = await createClient();
  // 발송 1건 = (교육원 요약행 1 + 학생별 N행). 이력 화면은 요약행만 보여
  // 발송당 1행이 되게 하고, 학생별 행은 팝업의 "수신 학생 목록"으로 활용한다.
  const [{ data: recent }, { data: recipientRows }] = await Promise.all([
    supabase
      .from("sms_messages")
      .select(
        "id, message_type, target_customer_id, target_center_id, content, sent_at"
      )
      .is("target_customer_id", null)
      .order("sent_at", { ascending: false })
      .limit(20),
    supabase
      .from("sms_messages")
      .select("target_customer_id, target_center_id, sent_at")
      .not("target_customer_id", "is", null)
      .order("sent_at", { ascending: false })
      .limit(500),
  ]);

  const { data: centers } = await supabase
    .from("training_centers")
    .select("id, name");
  const { data: customers } = await supabase
    .from("customers")
    .select("id, code, name_kr, name_vi");
  const centerMap = new Map((centers ?? []).map((c) => [c.id, c.name]));
  const customerMap = new Map(
    (customers ?? []).map((c) => [
      c.id,
      `${c.code} · ${c.name_kr || c.name_vi || "?"}`,
    ])
  );

  // 같은 발송(같은 sent_at + 교육원)의 학생 수신자 묶기
  const recipientsByKey = new Map<string, string[]>();
  for (const r of recipientRows ?? []) {
    if (!r.target_customer_id) continue;
    const key = `${r.sent_at}::${r.target_center_id ?? ""}`;
    const arr = recipientsByKey.get(key) ?? [];
    arr.push(customerMap.get(r.target_customer_id) ?? "?");
    recipientsByKey.set(key, arr);
  }

  const historyRows = (recent ?? []).map((m) => ({
    id: m.id,
    sentAt: formatDateTime(m.sent_at),
    type: m.message_type,
    target: m.target_center_id
      ? `교육원: ${centerMap.get(m.target_center_id) ?? "?"}`
      : m.target_customer_id
        ? customerMap.get(m.target_customer_id) ?? "?"
        : "—",
    content: m.content,
    recipients: recipientsByKey.get(`${m.sent_at}::${m.target_center_id ?? ""}`) ?? [],
  }));

  return (
    <>
      <PageHeader
        title="알림발송"
        description="NHN Cloud SMS — 신규 교육생 / 수수료 정산 발송"
        breadcrumbs={[{ label: "알림발송" }]}
      />
      <div className="p-6 space-y-6">
        {/* 진입 카드 2개 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/sms/new-student"
            className="group block rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-md bg-info/10 text-info flex items-center justify-center shrink-0">
                <GraduationCap className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium flex items-center gap-2">
                  신규 교육생 알림
                  <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  교육원별로 신규 등록된 교육생 리스트를 묶어 원장에게 SMS 발송
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/sms/commission"
            className="group block rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-md bg-success/10 text-success flex items-center justify-center shrink-0">
                <Receipt className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium flex items-center gap-2">
                  정산 내역 발송
                  <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  교육원별 정산 안내문 본문 미리보기 + 정산서 PDF (브라우저
                  인쇄로 저장) — 카카오톡/이메일로 직접 전송
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* 최근 발송 이력 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4" />
              최근 발송 이력
            </CardTitle>
            <CardDescription>최근 20건</CardDescription>
          </CardHeader>
          <CardContent>
            {historyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                발송 이력이 없습니다.
              </p>
            ) : (
              <SmsHistoryView rows={historyRows} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
