"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Loader2, Trash2 } from "lucide-react";

import {
  setEventGiftGiven,
  updateEventPayment,
  deleteEventPayment,
} from "@/app/(app)/customers/settlement-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueMap,
} from "@/components/ui/select";
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
  customerPhone: string | null;
  eventType: string;
  amount: number;
  giftType: string | null;
  friendCustomerId: string | null;
  friendName: string | null;
  friendPhone: string | null;
  giftGiven: boolean;
  giftGivenDate: string | null;
  createdAt: string;
};

type CustomerOption = {
  id: string;
  code: string;
  name_kr: string | null;
  name_vi: string | null;
};

export function SettlementEventRewardView({
  rows,
  giftTypes,
  customerOptions,
}: {
  rows: EventRewardRow[];
  giftTypes: string[];
  customerOptions: CustomerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [onlyUnpaid, setOnlyUnpaid] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(
    () => (onlyUnpaid ? rows.filter((r) => !r.giftGiven) : rows),
    [rows, onlyUnpaid]
  );

  const unpaidCount = rows.filter((r) => !r.giftGiven).length;

  function onToggle(row: EventRewardRow) {
    setBusyId(row.id);
    startTransition(async () => {
      const r = await setEventGiftGiven(row.id, !row.giftGiven);
      setBusyId(null);
      if (r.ok) {
        toast.success(
          row.giftGiven
            ? `${row.customerName} 지급 완료를 취소했습니다.`
            : `${row.customerName} 보상 지급 완료 처리했습니다.`
        );
        router.refresh();
      } else {
        toast.error("처리 실패", { description: r.error });
      }
    });
  }

  function onUpdateGiftType(row: EventRewardRow, newGiftType: string | null) {
    setBusyId(row.id);
    startTransition(async () => {
      const r = await updateEventPayment(row.id, row.customerId, {
        event_type: row.eventType,
        amount: row.amount,
        gift_type: newGiftType,
        friend_customer_id: row.friendCustomerId,
        gift_given: row.giftGiven,
        gift_given_date: row.giftGivenDate,
      });
      setBusyId(null);
      if (r.ok) {
        toast.success("상품권 변경 완료");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  function onUpdateFriend(row: EventRewardRow, newFriendId: string | null) {
    setBusyId(row.id);
    startTransition(async () => {
      const r = await updateEventPayment(row.id, row.customerId, {
        event_type: row.eventType,
        amount: row.amount,
        gift_type: row.giftType,
        friend_customer_id: newFriendId,
        gift_given: row.giftGiven,
        gift_given_date: row.giftGivenDate,
      });
      setBusyId(null);
      if (r.ok) {
        toast.success("친구 변경 완료");
        router.refresh();
      } else {
        toast.error("저장 실패", { description: r.error });
      }
    });
  }

  function onDelete(row: EventRewardRow) {
    if (!confirm(`${row.customerName} 의 이벤트 보상을 삭제하시겠습니까?`))
      return;
    setBusyId(row.id);
    startTransition(async () => {
      const r = await deleteEventPayment(row.id, row.customerId);
      setBusyId(null);
      if (r.ok) {
        toast.success("삭제 완료");
        router.refresh();
      } else {
        toast.error("삭제 실패", { description: r.error });
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
                <TableHead>교육생</TableHead>
                <TableHead className="w-28">이벤트</TableHead>
                <TableHead className="w-40">상품권</TableHead>
                <TableHead className="w-24 text-right">금액</TableHead>
                <TableHead className="w-56">친구</TableHead>
                <TableHead className="w-28">지급일</TableHead>
                <TableHead className="w-28 text-center">지급</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const isBusy = busyId === row.id;
                return (
                  <TableRow
                    key={row.id}
                    className={row.giftGiven ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="font-medium hover:text-primary"
                      >
                        {row.customerName}
                      </Link>
                      {row.customerPhone && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {row.customerPhone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{row.eventType}</TableCell>
                    <TableCell>
                      <Select
                        value={row.giftType ?? "__none__"}
                        onValueChange={(v) =>
                          onUpdateGiftType(row, v === "__none__" ? null : v)
                        }
                        disabled={pending && isBusy}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValueMap
                            map={{
                              __none__: "—",
                              ...Object.fromEntries(
                                giftTypes.map((g) => [g, g])
                              ),
                            }}
                            placeholder="선택"
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {giftTypes.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.amount ? formatCurrency(row.amount) : "—"}
                    </TableCell>
                    <TableCell>
                      {row.eventType === "친구 소개" ? (
                        <div className="space-y-1">
                          <Select
                            value={row.friendCustomerId ?? "__none__"}
                            onValueChange={(v) =>
                              onUpdateFriend(row, v === "__none__" ? null : v)
                            }
                            disabled={pending && isBusy}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValueMap
                                map={{
                                  __none__: "—",
                                  ...Object.fromEntries(
                                    customerOptions.map((c) => [
                                      c.id,
                                      c.name_kr || c.name_vi || "(이름 없음)",
                                    ])
                                  ),
                                }}
                                placeholder="선택"
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {customerOptions.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name_kr || c.name_vi || "(이름 없음)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {row.friendPhone && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {row.friendPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {row.giftGivenDate ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {isBusy ? (
                        <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggle(row)}
                          disabled={pending}
                          title={
                            row.giftGiven
                              ? "클릭하면 미지급으로"
                              : "클릭하면 지급 완료로"
                          }
                          className="inline-flex items-center transition-opacity hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {row.giftGiven ? (
                            <Badge className="border-success/20 bg-success/10 text-success cursor-pointer">
                              지급 완료
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground cursor-pointer"
                            >
                              미지급
                            </Badge>
                          )}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(row)}
                        disabled={pending}
                        className="text-destructive hover:text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
