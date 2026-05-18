"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  Settings2,
} from "lucide-react";

import {
  completeSettlementBatch,
  settleSingleCustomer,
} from "@/app/(app)/settlements/actions";
import {
  buildCommissionNotificationMessage,
  COMPANY_INFO,
} from "@/lib/sms-templates";
import { kstCurrentMonthFirstDay } from "@/lib/commission";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
};

export function SettlementPendingCenterRow({
  center,
  rows,
  settlementMonth,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  // 체크박스 상태 — default 는 isDue
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const r of rows) m[r.customerId] = r.isDue;
    return m;
  });

  // 공제 override
  const [overrides, setOverrides] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.customerId] = r.defaultDeduction;
    return m;
  });

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

  // SMS 본문 (확정 후 노출용)
  const message = useMemo(() => {
    const deductionRow = selectedRows.find(
      (r) => (overrides[r.customerId] ?? r.defaultDeduction) > 0
    );
    return buildCommissionNotificationMessage({
      center,
      settlementMonth,
      items: selectedRows.map((r) => ({
        customerName: r.customerName,
        classStartDate: r.classStartDate,
        classTypeLabel: r.classTypeLabel,
      })),
      totals: {
        tuitionSum: (center.tuition_fee_2026 ?? 0) * selectedRows.length,
        totalAmount: liveTotals.base,
        deductionAmount: liveTotals.deduction,
        receivedAmount: liveTotals.net,
      },
      deductionLabel: deductionRow?.deductionReason,
    });
  }, [selectedRows, overrides, center, settlementMonth, liveTotals]);

  const printHref = useMemo(() => {
    const items = selectedRows
      .map(
        (r) =>
          `${r.customerId}:${Math.max(0, Math.round(overrides[r.customerId] ?? r.defaultDeduction))}`
      )
      .join(",");
    return `/settlements/print?center=${center.id}&month=${settlementMonth.slice(0, 7)}&items=${encodeURIComponent(items)}`;
  }, [selectedRows, overrides, center.id, settlementMonth]);

  function setRowChecked(id: string, v: boolean) {
    setChecked((s) => ({ ...s, [id]: v }));
    setConfirmed(false);
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
    setConfirmed(true);
    toast.success("정산 내역이 확정되었습니다. 정산서 발송 가능합니다.");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("본문이 복사되었습니다. 카카오톡/이메일에 붙여넣기");
    } catch {
      toast.error("복사 실패");
    }
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
                        setChecked(m);
                        setConfirmed(false);
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
                            setOverrides((s) => ({
                              ...s,
                              [r.customerId]: Number(e.target.value) || 0,
                            }));
                            setConfirmed(false);
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

          {/* 확정 후 — 안내 + 본문 + 정산서 링크 */}
          {confirmed && selectedRows.length > 0 && (
            <Card className="p-4 bg-info/5 border-info/30 space-y-3">
              <div className="text-sm">
                <span className="font-semibold text-info">정산 내역이 확정되었습니다.</span>
                <span className="text-muted-foreground ml-2">
                  아래 본문 복사 + 정산서를 발송하세요. 입금 확인 후 [일괄 완료]
                  또는 행별 [정산 완료] 로 마무리.
                </span>
              </div>
              <div className="flex items-center gap-2">
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
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "gap-2"
                  )}
                >
                  <FileText className="size-4" />
                  정산서 열기 (PDF)
                </Link>
                <div className="ml-auto text-xs text-muted-foreground">
                  계좌: {COMPANY_INFO.bankName} {COMPANY_INFO.bankAccount}
                </div>
              </div>
              <Textarea
                value={message}
                readOnly
                rows={Math.min(28, Math.max(12, message.split("\n").length))}
                className="font-mono text-xs leading-relaxed"
                onFocus={(e) => e.target.select()}
              />
            </Card>
          )}
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
        className={cn(
          buttonVariants({ size: "sm", variant: "ghost" }),
          "text-success hover:text-success hover:bg-success/5"
        )}
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
