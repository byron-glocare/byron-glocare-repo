/**
 * /study-invoices/[id] — 인보이스 상세 + 송금 매칭 (B3-3/B3-4 통합).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SettlementSection } from "./settlement-section";

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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("study_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!inv) notFound();

  const [{ data: org }, { data: settlements }] = await Promise.all([
    supabase
      .from("study_center_orgs")
      .select("id, name_vi, name_ko, settlement_currency")
      .eq("id", inv.org_id)
      .maybeSingle(),
    supabase
      .from("study_settlements")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("received_at", { ascending: false }),
  ]);

  const lineItems = (Array.isArray(inv.line_items) ? inv.line_items : []) as Array<{
    description?: string;
    qty?: number;
    unit_price?: number;
    amount?: number;
  }>;

  const totalPaid = (settlements ?? []).reduce(
    (s, x) => s + Number(x.amount),
    0
  );
  const total = Number(inv.total_amount);
  const balance = total - totalPaid;

  return (
    <>
      <PageHeader
        title={`${org?.name_vi ?? "?"} — ${inv.period_start} ~ ${inv.period_end}`}
        description={`${total.toLocaleString()} ${inv.currency}`}
        breadcrumbs={[
          { label: "인보이스", href: "/study-invoices" },
          { label: org?.name_vi ?? "상세" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>
              {STATUS_LABEL[inv.status] ?? inv.status}
            </Badge>
            <Link
              href={`/study-invoices/${id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              편집
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* 요약 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">요약</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            <Info label="회사" value={org?.name_vi} />
            <Info label="기간" value={`${inv.period_start} ~ ${inv.period_end}`} />
            <Info
              label="청구액"
              value={`${total.toLocaleString()} ${inv.currency}`}
            />
            <Info
              label="납부액"
              value={`${totalPaid.toLocaleString()} ${inv.currency}`}
            />
            <Info
              label="잔액"
              value={
                balance > 0
                  ? `${balance.toLocaleString()} ${inv.currency}`
                  : balance === 0
                    ? "완납"
                    : `과납 ${Math.abs(balance).toLocaleString()} ${inv.currency}`
              }
            />
            <Info
              label="발송일"
              value={
                inv.sent_at
                  ? new Date(inv.sent_at).toLocaleString("ko-KR")
                  : null
              }
            />
            <Info
              label="납부일"
              value={
                inv.paid_at
                  ? new Date(inv.paid_at).toLocaleString("ko-KR")
                  : null
              }
            />
          </dl>
          {inv.tax_invoice_url ? (
            <div className="mt-3 text-sm">
              <a
                href={inv.tax_invoice_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                세금계산서 PDF
                <ExternalLink className="size-3" />
              </a>
            </div>
          ) : null}
        </Card>

        {/* 라인 아이템 */}
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">청구 항목</h2>
          {lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">항목 없음</p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">내역</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">수량</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">단가</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{it.description ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {it.qty ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {it.unit_price != null
                          ? Number(it.unit_price).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {it.amount != null
                          ? Number(it.amount).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-2 text-right font-medium">
                      합계
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {total.toLocaleString()} {inv.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        {/* 송금 매칭 (B3-4) */}
        <SettlementSection
          invoiceId={inv.id}
          currency={inv.currency}
          settlements={(settlements ?? []).map((s) => ({
            id: s.id,
            amount: Number(s.amount),
            currency: s.currency,
            received_at: s.received_at,
            bank_reference: s.bank_reference,
            attached_proof_url: s.attached_proof_url,
            note: s.note,
          }))}
          balance={balance}
        />
      </div>
    </>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value ?? "—"}</dd>
    </div>
  );
}
