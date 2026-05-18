"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, FileText } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  customerId: string;
  customerName: string;
  classStartDate: string | null;
  classTypeLabel: string | null;
  tuitionBase: number;
  deduction: number;
  net: number;
};

type Group = {
  centerId: string;
  centerName: string;
  region: string | null;
  rows: Row[];
  totals: { total: number; deduction: number; net: number };
  message: string;
};

type Props = {
  settlementMonth: string; // YYYY-MM-01
  monthOptions: string[]; // YYYY-MM
  groups: Group[];
};

export function SmsCommissionView({
  settlementMonth,
  monthOptions,
  groups,
}: Props) {
  const router = useRouter();
  const ym = settlementMonth.slice(0, 7);

  function handleMonthChange(value: string) {
    router.push(`/sms/commission?month=${value}`);
  }

  return (
    <div className="space-y-4">
      {/* 월 선택 */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            정산 월
          </label>
          <select
            value={ym}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-32"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          {ym} 정산 예정 — 교육원 {groups.length}곳 / 총{" "}
          {groups.reduce((s, g) => s + g.rows.length, 0)}명
        </div>
      </div>

      {groups.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          {ym} 정산 예정 항목이 없습니다.
        </Card>
      ) : (
        groups.map((g) => (
          <GroupRow key={g.centerId} group={g} settlementMonth={settlementMonth} />
        ))
      )}
    </div>
  );
}

function GroupRow({
  group,
  settlementMonth,
}: {
  group: Group;
  settlementMonth: string;
}) {
  const [open, setOpen] = useState(false);
  const printHref = `/settlements/print?center=${group.centerId}&month=${settlementMonth.slice(0, 7)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(group.message);
      toast.success("본문이 복사되었습니다. 카카오톡/이메일 등에 붙여넣으세요.");
    } catch {
      toast.error("복사 실패 — 본문을 직접 선택해 복사해주세요.");
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 hover:text-primary min-w-0"
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <span className="font-semibold truncate">{group.centerName}</span>
          {group.region && (
            <Badge variant="outline" className="text-xs shrink-0">
              {group.region}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs shrink-0">
            {group.rows.length}명
          </Badge>
        </button>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs text-muted-foreground hidden sm:block">
            정산액{" "}
            <span className="font-mono font-medium text-foreground">
              {formatCurrency(group.totals.net)}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
          >
            <Copy className="size-4" />
            본문 복사
          </Button>
          <Link
            href={printHref}
            target="_blank"
            rel="noopener"
            className={cn(buttonVariants({ size: "sm" }), "gap-2")}
          >
            <FileText className="size-4" />
            정산서 열기
          </Link>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {/* 교육생 표 */}
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">이름</th>
                  <th className="px-3 py-2 text-left font-medium">개강일정</th>
                  <th className="px-3 py-2 text-right font-medium">
                    수강료 × 25%
                  </th>
                  <th className="px-3 py-2 text-right font-medium">공제</th>
                  <th className="px-3 py-2 text-right font-medium">정산액</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr key={r.customerId} className="border-t border-border">
                    <td className="px-3 py-2">{r.customerName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.classStartDate ?? "—"}
                      {r.classTypeLabel ? ` (${r.classTypeLabel})` : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(r.tuitionBase)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.deduction > 0
                        ? `−${formatCurrency(r.deduction)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {formatCurrency(r.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SMS 본문 미리보기 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                알림 본문 (카카오톡/이메일 본문에 그대로 붙여넣기)
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCopy}
              >
                <Copy className="size-3.5" />
                복사
              </Button>
            </div>
            <Textarea
              value={group.message}
              readOnly
              rows={Math.min(28, Math.max(12, group.message.split("\n").length))}
              className="font-mono text-xs leading-relaxed"
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
