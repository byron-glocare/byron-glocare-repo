import Link from "next/link";
import { GraduationCap, ArrowRight, Clock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("sms_messages")
    .select(
      "id, message_type, target_customer_id, target_center_id, content, sent_at"
    )
    .order("sent_at", { ascending: false })
    .limit(20);

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

          {/* 수수료 정산 알림은 /settlements 페이지에서 교육원×월 단위 정산과
              통합 예정 — 0007 이후 리디자인 중 */}
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
            {!recent || recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
                발송 이력이 없습니다.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">발송일시</TableHead>
                      <TableHead className="w-36">타입</TableHead>
                      <TableHead className="w-52">대상</TableHead>
                      <TableHead>미리보기</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">
                          {formatDateTime(m.sent_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{m.message_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {m.target_center_id
                            ? `교육원: ${centerMap.get(m.target_center_id) ?? "?"}`
                            : m.target_customer_id
                              ? customerMap.get(m.target_customer_id) ?? "?"
                              : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-lg truncate">
                          {m.content.split("\n")[0]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
