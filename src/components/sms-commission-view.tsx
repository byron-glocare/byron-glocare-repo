"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Loader2, Send } from "lucide-react";

import { sendCommissionSettlementSms } from "@/app/(app)/sms/actions";
import { buildCommissionSettlementMessage } from "@/lib/sms-templates";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { CommissionPayment } from "@/types/database";

type Center = {
  id: string;
  name: string;
  region: string | null;
  director_name: string | null;
  phone: string | null;
  bank_name: string | null;
  bank_account: string | null;
};

type Customer = {
  id: string;
  code: string;
  name_kr: string | null;
  name_vi: string | null;
  training_center_id: string | null;
};

type Props = {
  centers: Center[];
  customers: Customer[];
  commissions: CommissionPayment[];
  year: number;
  month: number;
  selectedMonth: string; // YYYY-MM
};

const NOTE_STORAGE_KEY = "glocare:sms:commission:note";

export function SmsCommissionView({
  centers,
  customers,
  commissions,
  year,
  month,
  selectedMonth,
}: Props) {
  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );
  const centerMap = useMemo(
    () => new Map(centers.map((c) => [c.id, c])),
    [centers]
  );

  // 교육원별 그룹핑
  const groups = useMemo(() => {
    const byCenter = new Map<string, CommissionPayment[]>();
    for (const cp of commissions) {
      const existing = byCenter.get(cp.training_center_id);
      if (existing) existing.push(cp);
      else byCenter.set(cp.training_center_id, [cp]);
    }
    return [...byCenter.entries()]
      .map(([centerId, items]) => ({
        center: centerMap.get(centerId),
        items,
      }))
      .filter((g) => g.center)
      .sort((a, b) => (a.center?.name ?? "").localeCompare(b.center?.name ?? ""));
  }, [commissions, centerMap]);

  return (
    <div className="space-y-6">
      <form method="get" className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            정산 대상 월
          </label>
          <Input
            type="month"
            name="month"
            defaultValue={selectedMonth}
            className="w-44"
          />
        </div>
        <button
          type="submit"
          className={buttonVariants({ variant: "outline" })}
        >
          적용
        </button>
      </form>

      {groups.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          {year}년 {month}월 미정산 소개비가 없습니다.
        </Card>
      ) : (
        groups.map((g) => (
          <CommissionCenterCard
            key={g.center!.id}
            center={g.center!}
            items={g.items}
            customerMap={customerMap}
            year={year}
            month={month}
          />
        ))
      )}
    </div>
  );
}

function CommissionCenterCard({
  center,
  items,
  customerMap,
  year,
  month,
}: {
  center: Center;
  items: CommissionPayment[];
  customerMap: Map<string, Customer>;
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [note, setNote] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(NOTE_STORAGE_KEY) ?? "";
  });
  const [selectedIds, setSelectedIds] = useState<string[]>(items.map((i) => i.id));

  const selectedItems = items.filter((i) => selectedIds.includes(i.id));
  const totals = selectedItems.reduce(
    (acc, i) => {
      acc.total += i.total_amount;
      acc.deduction += i.deduction_amount;
      acc.received += i.received_amount ?? i.total_amount - i.deduction_amount;
      return acc;
    },
    { total: 0, deduction: 0, received: 0 }
  );

  const message = buildCommissionSettlementMessage({
    centerName: center.name,
    bankName: center.bank_name,
    bankAccount: center.bank_account,
    year,
    month,
    items: selectedItems.map((it) => ({
      customerName:
        customerMap.get(it.customer_id)?.name_kr ||
        customerMap.get(it.customer_id)?.name_vi ||
        "—",
      totalAmount: it.total_amount,
      deductionAmount: it.deduction_amount,
      receivedAmount: it.received_amount ?? it.total_amount - it.deduction_amount,
    })),
    extraNote: note,
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSend() {
    if (selectedItems.length === 0) {
      toast.error("발송 대상을 선택하세요.");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NOTE_STORAGE_KEY, note);
    }

    startTransition(async () => {
      const result = await sendCommissionSettlementSms({
        centerId: center.id,
        year,
        month,
        commissionPaymentIds: selectedIds,
        extraNote: note,
      });
      if (result.ok) {
        if ("warning" in result && result.warning) {
          toast.warning(result.warning);
        } else {
          toast.success(`${center.name} 원장님께 정산 안내 발송 완료`);
        }
        setPreviewOpen(false);
        router.refresh();
      } else {
        toast.error("발송 실패", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            {center.name}
            {center.region && <Badge variant="outline">{center.region}</Badge>}
          </CardTitle>
          <CardDescription>
            원장 {center.director_name ?? "—"} ·{" "}
            {center.phone ?? (
              <span className="text-destructive">전화번호 없음</span>
            )}{" "}
            · 정산 대상 {items.length}명
          </CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={selectedItems.length === 0}
          >
            <Eye className="size-3" />
            미리보기
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={pending || selectedItems.length === 0 || !center.phone}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Send className="size-3" />
            )}
            발송
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>고객</TableHead>
                <TableHead className="text-right">총액</TableHead>
                <TableHead className="text-right">공제</TableHead>
                <TableHead className="text-right">수령액</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const c = customerMap.get(it.customer_id);
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(it.id)}
                        onChange={() => toggleSelect(it.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {c?.name_kr || c?.name_vi || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {c?.code}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(it.total_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(it.deduction_amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(
                        it.received_amount ?? it.total_amount - it.deduction_amount
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={it.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell />
                <TableCell className="font-medium">소계 (선택)</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(totals.total)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(totals.deduction)}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatCurrency(totals.received)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            추가 메모 (마지막 입력값 저장)
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="입금 기한, 특이사항 등"
          />
        </div>
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>메시지 미리보기</DialogTitle>
            <DialogDescription>
              {center.name} 원장 {center.phone} 으로 발송 예정
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
            {message}
          </pre>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              닫기
            </Button>
            <Button type="button" onClick={handleSend} disabled={pending}>
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
              이대로 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatusBadge({ status }: { status: CommissionPayment["status"] }) {
  const cls =
    status === "completed"
      ? "bg-success/10 text-success border-success/20"
      : status === "notified"
        ? "bg-info/10 text-info border-info/20"
        : "bg-muted text-muted-foreground border-border";
  const label =
    status === "completed" ? "완료" : status === "notified" ? "발송됨" : "대기";
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}
