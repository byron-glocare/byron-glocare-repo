"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { completeSettlementBatch } from "@/app/(app)/settlements/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { TrainingCenter } from "@/types/database";

type PendingRow = {
  customerId: string;
  customerName: string;
  customerCode: string;
  dueDate: string;
  tuitionBase: number;
  defaultDeduction: number;
  deductionReason: string;
};

type Props = {
  center: Pick<TrainingCenter, "id" | "name" | "region" | "tuition_fee_2026">;
  rows: PendingRow[];
  totalBase: number;
  totalDefaultDeduction: number;
  totalNet: number;
  settlementMonth: string; // YYYY-MM-01
};

export function SettlementPendingCenterRow({
  center,
  rows,
  totalBase,
  totalDefaultDeduction,
  totalNet,
  settlementMonth,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  // 개별 공제 override — key = customerId
  const [overrides, setOverrides] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.customerId] = r.defaultDeduction;
    return m;
  });

  const liveTotals = useMemo(() => {
    let deduction = 0;
    let net = 0;
    for (const r of rows) {
      const d = overrides[r.customerId] ?? r.defaultDeduction;
      deduction += d;
      net += r.tuitionBase - d;
    }
    return { deduction, net };
  }, [overrides, rows]);

  function handleComplete() {
    startTransition(async () => {
      const result = await completeSettlementBatch({
        settlement_month: settlementMonth,
        training_center_id: center.id,
        items: rows.map((r) => ({
          customer_id: r.customerId,
          total_amount: r.tuitionBase,
          deduction_amount: Math.max(
            0,
            Math.round(overrides[r.customerId] ?? r.defaultDeduction)
          ),
        })),
      });
      if (!result.ok) {
        toast.error("완료 처리 실패", { description: result.error });
        return;
      }
      toast.success(`${result.data.inserted}건 정산 완료로 표시됨`);
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
            href={`/training-centers/${center.id}`}
            className="font-semibold hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {center.name}
          </Link>
          {center.region && (
            <Badge variant="outline" className="text-xs">
              {center.region}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {rows.length}명
          </Badge>
        </button>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <div className="text-xs text-muted-foreground">
            수강료25% <span className="font-mono">{formatCurrency(totalBase)}</span>
            {" · "}
            공제{" "}
            <span className="font-mono">
              −{formatCurrency(liveTotals.deduction)}
            </span>
          </div>
          <div className="text-base font-semibold">
            {formatCurrency(liveTotals.net)}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleComplete}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            완료 처리
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">교육생</TableHead>
                <TableHead className="w-28">코드</TableHead>
                <TableHead className="w-28">정산예정일</TableHead>
                <TableHead className="w-32 text-right">수강료 × 25%</TableHead>
                <TableHead className="w-32 text-right">공제 (편집)</TableHead>
                <TableHead className="w-40">공제 사유</TableHead>
                <TableHead className="w-32 text-right">순 정산액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const d = overrides[r.customerId] ?? r.defaultDeduction;
                return (
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
                    <TableCell className="text-xs">
                      {formatDate(r.dueDate)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(r.tuitionBase)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        value={d}
                        onChange={(e) =>
                          setOverrides((s) => ({
                            ...s,
                            [r.customerId]: Number(e.target.value) || 0,
                          }))
                        }
                        className="h-8 text-right font-mono"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.deductionReason}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(Math.max(0, r.tuitionBase - d))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
