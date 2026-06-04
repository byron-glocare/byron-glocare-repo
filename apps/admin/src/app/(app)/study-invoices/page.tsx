/**
 * /study-invoices — 인보이스 목록 (B3-3).
 *   draft / sent / paid / cancelled.
 */

import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  sent: "발송됨",
  paid: "납부 완료",
  cancelled: "취소",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  sent: "secondary",
  paid: "default",
  cancelled: "destructive",
};

export default async function StudyInvoicesPage() {
  const supabase = await createClient();

  const [{ data: invoices, error }, { data: orgs }] = await Promise.all([
    supabase
      .from("study_invoices")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("study_center_orgs").select("id, name_vi, name_ko"),
  ]);

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o]));

  // 송금 합계 (paid 여부 확인 보조)
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const { data: settlements } =
    invoiceIds.length > 0
      ? await supabase
          .from("study_settlements")
          .select("invoice_id, amount")
          .in("invoice_id", invoiceIds)
      : { data: [] as Array<{ invoice_id: string; amount: number }> };
  const paidMap = new Map<string, number>();
  for (const s of settlements ?? []) {
    paidMap.set(
      s.invoice_id,
      (paidMap.get(s.invoice_id) ?? 0) + Number(s.amount)
    );
  }

  return (
    <>
      <PageHeader
        title="인보이스"
        description="유학센터별 청구. 기간·라인아이템·송금 매칭."
        breadcrumbs={[{ label: "인보이스" }]}
        actions={
          <Link href="/study-invoices/new" className={buttonVariants()}>
            <Plus className="size-4" />
            인보이스 발행
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !invoices || invoices.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 발행한 인보이스가 없습니다.
            </p>
            <Link
              href="/study-invoices/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Plus className="size-4" />첫 인보이스 발행
            </Link>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>회사</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead className="text-right">청구액</TableHead>
                  <TableHead className="text-right">납부액</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead>발송</TableHead>
                  <TableHead>납부</TableHead>
                  <TableHead className="text-right">조치</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const org = orgMap.get(inv.org_id);
                  const paid = paidMap.get(inv.id) ?? 0;
                  const total = Number(inv.total_amount);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/study-invoices/${inv.id}`}
                          className="font-medium hover:underline"
                        >
                          {org?.name_vi ?? "?"}
                        </Link>
                        {org?.name_ko ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {org.name_ko}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inv.period_start} ~ {inv.period_end}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {total.toLocaleString()} {inv.currency}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {paid > 0 ? (
                          <span
                            className={
                              paid >= total
                                ? "text-success"
                                : "text-amber-600 dark:text-amber-400"
                            }
                          >
                            {paid.toLocaleString()} {inv.currency}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>
                          {STATUS_LABEL[inv.status] ?? inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.sent_at
                          ? new Date(inv.sent_at).toLocaleDateString("ko-KR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.paid_at
                          ? new Date(inv.paid_at).toLocaleDateString("ko-KR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/study-invoices/${inv.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          상세
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
