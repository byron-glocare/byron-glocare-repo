"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
// 체크/공제 override state 는 페이지 레벨 (`PendingTabClient`) 에서 lift up.
// 이 컴포넌트는 controlled — props 의 checked/overrides 를 사용하고 변경은 콜백으로 위임.
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Settings2,
} from "lucide-react";

import {
  completeSettlementBatch,
  settleSingleCustomer,
} from "@/app/(app)/settlements/actions";
import { kstCurrentMonthFirstDay } from "@/lib/commission";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrainingCenter } from "@/types/database";

type PendingRow = {
  customerId: string;
  customerName: string;
  customerCode: string;
  classStartDate: string | null;
  classTypeLabel: string | null;
  tuitionFee: number;
  dueDate: string;
  isDue: boolean;
  tuitionBase: number;
  defaultDeduction: number;
  deductionReason: string;
};

type Props = {
  center: Pick<
    TrainingCenter,
    | "id"
    | "name"
    | "region"
    | "tuition_fee_2026"
    | "business_number"
    | "director_name"
    | "email"
  >;
  rows: PendingRow[];
  totalBase: number;
  totalDefaultDeduction: number;
  totalNet: number;
  settlementMonth: string; // YYYY-MM-01
  /** controlled — 페이지 레벨 (PendingTabClient) 에서 state 보유 */
  checked: Record<string, boolean>;
  overrides: Record<string, number>;
  onCheckedChange: (customerId: string, v: boolean) => void;
  /** 전체 토글 등 — 한 번에 교체 */
  onCheckedReplace: (next: Record<string, boolean>) => void;
  onOverrideChange: (customerId: string, v: number) => void;
};

export function SettlementPendingCenterRow({
  center,
  rows,
  settlementMonth,
  checked,
  overrides,
  onCheckedChange,
  onCheckedReplace,
  onOverrideChange,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedRows = useMemo(
    () => rows.filter((r) => checked[r.customerId]),
    [rows, checked]
  );

  const liveTotals = useMemo(() => {
    let base = 0;
    let deduction = 0;
    let net = 0;
    for (const r of selectedRows) {
      const d = overrides[r.customerId] ?? r.defaultDeduction;
      base += r.tuitionBase;
      deduction += d;
      net += r.tuitionBase - d;
    }
    return { base, deduction, net };
  }, [selectedRows, overrides]);

  function setRowChecked(id: string, v: boolean) {
    onCheckedChange(id, v);
  }

  function handleBulkComplete() {
    if (selectedRows.length === 0) {
      toast.error("선택된 교육생이 없습니다.");
      return;
    }
    startTransition(async () => {
      const result = await completeSettlementBatch({
        settlement_month: settlementMonth,
        training_center_id: center.id,
        status: "completed",
        items: selectedRows.map((r) => ({
          customer_id: r.customerId,
          total_amount: r.tuitionBase,
          deduction_amount: Math.max(
            0,
            Math.round(overrides[r.customerId] ?? r.defaultDeduction)
          ),
        })),
      });
      if (!result.ok) {
        toast.error("일괄 완료 실패", { description: result.error });
        return;
      }
      toast.success(`${result.data.inserted}건 정산 완료로 처리됨`);
      router.refresh();
    });
  }

  function handleSingleComplete(r: PendingRow) {
    startTransition(async () => {
      // 해당 customer 의 dueDate 월로 settle (기본 currentMonth fallback)
      const monthFromDue = r.dueDate
        ? `${r.dueDate.slice(0, 7)}-01`
        : kstCurrentMonthFirstDay();
      const result = await settleSingleCustomer({
        customer_id: r.customerId,
        training_center_id: center.id,
        settlement_month: monthFromDue,
        total_amount: r.tuitionBase,
        deduction_amount: Math.max(
          0,
          Math.round(overrides[r.customerId] ?? r.defaultDeduction)
        ),
        status: "completed",
      });
      if (!result.ok) {
        toast.error("완료 처리 실패", { description: result.error });
        return;
      }
      toast.success(`${r.customerName} 정산 완료 처리됨`);
      router.refresh();
    });
  }

  function handleConfirm() {
    if (selectedRows.length === 0) {
      toast.error("선택된 교육생이 없습니다.");
      return;
    }
    if (
      !confirm(
        `선택한 ${selectedRows.length}명을 정산 확정합니다.\n확정된 항목은 정산 예정에서 빠지고 [정산 내역 발송] 페이지로 이동합니다.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await completeSettlementBatch({
        settlement_month: settlementMonth,
        training_center_id: center.id,
        status: "confirmed",
        items: selectedRows.map((r) => ({
          customer_id: r.customerId,
          total_amount: r.tuitionBase,
          deduction_amount: Math.max(
            0,
            Math.round(overrides[r.customerId] ?? r.defaultDeduction)
          ),
        })),
      });
      if (!result.ok) {
        toast.error("정산 확정 실패", { description: result.error });
        return;
      }
      toast.success(
        `${result.data.inserted}건 확정 처리됨. 정산 내역 발송 페이지로 이동합니다.`
      );
      router.push("/sms/commission");
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
            {selectedRows.length}/{rows.length}명
          </Badge>
        </button>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="text-base font-semibold">
            {formatCurrency(liveTotals.net)}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setExpanded((v) => !v)}
          >
            <Settings2 className="size-4" />
            관리
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 p-4">
          {/* 교육생 표 */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <input
                      type="checkbox"
                      className="size-4 align-middle"
                      checked={
                        rows.length > 0 &&
                        rows.every((r) => checked[r.customerId])
                      }
                      onChange={(e) => {
                        const next = e.target.checked;
                        const m: Record<string, boolean> = {};
                        for (const r of rows) m[r.customerId] = next;
                        onCheckedReplace(m);
                      }}
                      aria-label="전체 선택"
                    />
                  </TableHead>
                  <TableHead className="w-32">교육생</TableHead>
                  <TableHead className="w-28">강의 시작일</TableHead>
                  <TableHead className="w-28 text-right">수강료</TableHead>
                  <TableHead className="w-32 text-right">
                    수강료 × 25%
                  </TableHead>
                  <TableHead className="w-32 text-right">공제 (편집)</TableHead>
                  <TableHead className="w-32">공제 사유</TableHead>
                  <TableHead className="w-32 text-right">순 정산액</TableHead>
                  <TableHead className="w-28 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const d = overrides[r.customerId] ?? r.defaultDeduction;
                  return (
                    <TableRow
                      key={r.customerId}
                      className={cn(
                        !checked[r.customerId] && "opacity-60",
                        !r.isDue &&
                          checked[r.customerId] &&
                          "bg-info/5"
                      )}
                    >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          className="size-4 align-middle"
                          checked={!!checked[r.customerId]}
                          onChange={(e) =>
                            setRowChecked(r.customerId, e.target.checked)
                          }
                          aria-label={`${r.customerName} 선택`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/customers/${r.customerId}`}
                          className="hover:text-primary"
                        >
                          {r.customerName}
                        </Link>
                        {!r.isDue && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-[10px] py-0 px-1 bg-warning/10 text-warning border-warning/20"
                          >
                            도래 전
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.classStartDate ? formatDate(r.classStartDate) : "—"}
                        {r.classTypeLabel ? ` (${r.classTypeLabel})` : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency(r.tuitionFee)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(r.tuitionBase)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={d}
                          onChange={(e) => {
                            onOverrideChange(
                              r.customerId,
                              Number(e.target.value) || 0
                            );
                          }}
                          className="h-8 text-right font-mono"
                          disabled={!checked[r.customerId]}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.deductionReason}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(Math.max(0, r.tuitionBase - d))}
                      </TableCell>
                      <TableCell className="text-right">
                        <SingleConfirmDialog
                          customerName={r.customerName}
                          totalAmount={r.tuitionBase}
                          deductionAmount={Math.max(0, Math.round(d))}
                          onConfirm={() => handleSingleComplete(r)}
                          pending={pending}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 합계 + 액션 버튼 */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">
                선택 {selectedRows.length}/{rows.length}명
              </span>
              <span className="text-muted-foreground">
                · 수강료 25%{" "}
                <span className="font-mono">
                  {formatCurrency(liveTotals.base)}
                </span>
                {" · "}
                공제{" "}
                <span className="font-mono">
                  −{formatCurrency(liveTotals.deduction)}
                </span>
                {" · "}
                정산액{" "}
                <span className="font-semibold text-foreground font-mono">
                  {formatCurrency(liveTotals.net)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleBulkComplete}
                disabled={pending || selectedRows.length === 0}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                일괄 완료
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                disabled={pending || selectedRows.length === 0}
              >
                <FileText className="size-4" />
                정산 금액 확정
              </Button>
            </div>
          </div>

        </div>
      )}
    </Card>
  );
}

function SingleConfirmDialog({
  customerName,
  totalAmount,
  deductionAmount,
  onConfirm,
  pending,
}: {
  customerName: string;
  totalAmount: number;
  deductionAmount: number;
  onConfirm: () => void;
  pending: boolean;
}) {
  const net = Math.max(0, totalAmount - deductionAmount);
  return (
    <Dialog>
      <DialogTrigger
        className={buttonVariants({ size: "sm", variant: "outline" })}
        disabled={pending}
      >
        <Check className="size-4" />
        정산 완료
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>정산 완료 처리</DialogTitle>
          <DialogDescription>
            <strong>{customerName}</strong> 의 정산을 완료 처리합니다.
            <br />
            수강료 25%: {formatCurrency(totalAmount)} / 공제:{" "}
            {formatCurrency(deductionAmount)} / 순 정산액:{" "}
            <strong>{formatCurrency(net)}</strong>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            확인 — 완료 처리
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
