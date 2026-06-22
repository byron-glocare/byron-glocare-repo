"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Loader2 } from "lucide-react";

import { setEventGiftGiven } from "@/app/(app)/customers/settlement-actions";
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
import { formatCurrency } from "@/lib/format";

export type EventRewardRow = {
  id: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  eventType: string;
  amount: number;
  giftType: string | null;
  friendName: string | null;
  giftGiven: boolean;
  giftGivenDate: string | null;
  createdAt: string;
};

export function SettlementEventRewardView({ rows }: { rows: EventRewardRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [onlyUnpaid, setOnlyUnpaid] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(
    () => (onlyUnpaid ? rows.filter((r) => !r.giftGiven) : rows),
    [rows, onlyUnpaid]
  );

  const unpaidCount = rows.filter((r) => !r.giftGiven).length;

  function onToggle(row: EventRewardRow, given: boolean) {
    setBusyId(row.id);
    startTransition(async () => {
      const r = await setEventGiftGiven(row.id, given);
      setBusyId(null);
      if (r.ok) {
        toast.success(
          given
            ? `${row.customerName} 보상 지급 완료 처리했습니다.`
            : `${row.customerName} 지급 완료를 취소했습니다.`
        );
        router.refresh();
      } else {
        toast.error("처리 실패", { description: r.error });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gift className="size-4" />
          이벤트 보상 대상 {rows.length}건 · 미지급{" "}
          <Badge variant="secondary">{unpaidCount}건</Badge>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={onlyUnpaid}
            onChange={(e) => setOnlyUnpaid(e.target.checked)}
            className="size-4"
          />
          미지급만 보기
        </label>
      </div>

      {visible.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          {onlyUnpaid
            ? "미지급 이벤트 보상이 없습니다."
            : "등록된 이벤트 보상이 없습니다."}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-center">지급 완료</TableHead>
                <TableHead>교육생</TableHead>
                <TableHead>이벤트</TableHead>
                <TableHead>보상</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>친구</TableHead>
                <TableHead className="w-28">지급일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id} className={row.giftGiven ? "opacity-60" : ""}>
                  <TableCell className="text-center">
                    {busyId === row.id ? (
                      <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={row.giftGiven}
                        disabled={pending}
                        onChange={(e) => onToggle(row, e.target.checked)}
                        className="size-4 cursor-pointer"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-medium hover:text-primary"
                    >
                      {row.customerName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.customerCode}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{row.eventType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.giftType ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {row.amount ? formatCurrency(row.amount) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.friendName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {row.giftGiven ? (
                      <Badge className="border-success/20 bg-success/10 text-success">
                        {row.giftGivenDate ?? "완료"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        대기
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {onlyUnpaid && unpaidCount > 0 && (
        <p className="text-xs text-muted-foreground">
          체크하면 오늘 날짜로 “지급 완료” 처리됩니다. 잘못 눌렀으면 “미지급만 보기”를
          끄고 체크를 해제하세요.
        </p>
      )}
    </div>
  );
}
