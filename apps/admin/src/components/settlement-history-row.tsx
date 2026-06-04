"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Loader2,
  Undo2,
} from "lucide-react";

import { revertSettlementBatch } from "@/app/(app)/settlements/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

type HistoryRow = {
  customerId: string;
  customerName: string;
  customerCode: string;
  totalAmount: number;
  deductionAmount: number;
};

type Props = {
  centerId: string;
  centerName: string;
  settlementMonth: string; // YYYY-MM-01
  status: "completed" | "abandoned";
  rows: HistoryRow[];
  totalBase: number;
  totalDeduction: number;
  totalNet: number;
  completedAt: string;
};

export function SettlementHistoryRow({
  centerId,
  centerName,
  settlementMonth,
  status,
  rows,
  totalBase,
  totalDeduction,
  totalNet,
  completedAt,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  const isAbandoned = status === "abandoned";

  function handleRevert() {
    const label = isAbandoned ? "수금 포기" : "정산";
    if (
      !confirm(
        `${centerName} - ${settlementMonth.slice(0, 7)} ${label} ${rows.length}건을 되돌리시겠습니까?`
      )
    )
      return;

    startTransition(async () => {
      const result = await revertSettlementBatch({
        settlement_month: settlementMonth,
        training_center_id: centerId,
        status,
      });
      if (!result.ok) {
        toast.error("되돌리기 실패", { description: result.error });
        return;
      }
      toast.success(`${result.data.deleted}건 되돌림 — 정산 예정으로 이동`);
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 hover:text-primary"
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          <Link
            href={`/training-centers/${centerId}`}
            className="font-semibold hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {centerName}
          </Link>
          <Badge variant="outline" className="text-xs font-mono">
            {settlementMonth.slice(0, 7)}
          </Badge>
          {isAbandoned ? (
            <Badge
              variant="outline"
              className="text-xs bg-destructive/10 text-destructive border-destructive/20"
            >
              수금 포기
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-xs bg-success/10 text-success border-success/20"
            >
              완료
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {rows.length}명
          </Badge>
          <span className="text-xs text-muted-foreground">
            처리 {formatDate(completedAt.slice(0, 10))}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <div className="text-xs text-muted-foreground">
            수강료25% <span className="font-mono">{formatCurrency(totalBase)}</span>
            {" · "}
            공제 <span className="font-mono">−{formatCurrency(totalDeduction)}</span>
          </div>
          <div className="text-base font-semibold">
            {formatCurrency(totalNet)}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            title="알림 발송은 다음 단계에서 추가 예정"
          >
            <Bell className="size-4" />
            알림 발송
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRevert}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Undo2 className="size-4" />
            )}
            되돌리기
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">교육생</TableHead>
                <TableHead className="w-28">코드</TableHead>
                <TableHead className="w-32 text-right">수강료 × 25%</TableHead>
                <TableHead className="w-32 text-right">공제</TableHead>
                <TableHead className="w-32 text-right">순 정산액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.customerId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/customers/${r.customerId}`}
                      className="hover:text-primary"
                    >
                      {r.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.customerCode}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(r.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    −{formatCurrency(r.deductionAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(
                      Math.max(0, r.totalAmount - r.deductionAmount)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
