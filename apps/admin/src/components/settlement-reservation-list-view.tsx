"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dash, formatCurrency, formatDate } from "@/lib/format";

const PAGE_SIZE = 50;

export type ReservationListRow = {
  /** payment id + type 조합으로 unique 키 */
  key: string;
  /** payment_date 또는 reservation_date */
  date: string | null;
  type: "교육" | "웰컴팩";
  customerId: string;
  customerName: string;
  customerCode: string;
  centerName: string | null;
  amount: number;
  /** 교육예약금에만 의미 — 웰컴팩은 0 */
  refundAmount: number;
  refundDate: string | null;
  refundReason: string | null;
};

type Props = {
  rows: ReservationListRow[];
};

type TypeFilter = "all" | "교육" | "웰컴팩";
type RefundFilter = "all" | "refunded" | "not_refunded";

export function SettlementReservationListView({ rows }: Props) {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [refundFilter, setRefundFilter] = useState<RefundFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = [r.customerName, r.customerCode, r.centerName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (refundFilter === "refunded" && r.refundAmount <= 0) return false;
      if (refundFilter === "not_refunded" && r.refundAmount > 0) return false;
      return true;
    });
  }, [rows, q, typeFilter, refundFilter]);

  const totals = useMemo(() => {
    let amount = 0;
    let refund = 0;
    for (const r of filtered) {
      amount += r.amount;
      refund += r.refundAmount;
    }
    return { amount, refund, net: amount - refund };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function resetFilters() {
    setQ("");
    setTypeFilter("all");
    setRefundFilter("all");
    setPage(1);
  }

  const hasAnyFilter =
    !!q || typeFilter !== "all" || refundFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-60">
          <label className="text-xs text-muted-foreground block mb-1">
            검색 (이름 · 코드 · 교육원)
          </label>
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="이름 / CVN / 교육원명..."
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            타입
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as TypeFilter);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-28"
          >
            <option value="all">전체</option>
            <option value="교육">교육</option>
            <option value="웰컴팩">웰컴팩</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            환불
          </label>
          <select
            value={refundFilter}
            onChange={(e) => {
              setRefundFilter(e.target.value as RefundFilter);
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-28"
          >
            <option value="all">전체</option>
            <option value="refunded">환불 있음</option>
            <option value="not_refunded">환불 없음</option>
          </select>
        </div>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className={buttonVariants({ variant: "ghost" })}
          >
            초기화
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          전체 {filtered.length}건 (rows {rows.length}건 중)
        </span>
        <span>
          예약금 합계{" "}
          <span className="font-mono text-foreground">
            {formatCurrency(totals.amount)}
          </span>
        </span>
        <span>
          환불 합계{" "}
          <span className="font-mono text-foreground">
            −{formatCurrency(totals.refund)}
          </span>
        </span>
        <span>
          순 합계{" "}
          <span className="font-mono font-semibold text-foreground">
            {formatCurrency(totals.net)}
          </span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground space-y-2">
          <div>
            {hasAnyFilter
              ? "조건에 맞는 예약금 내역이 없습니다."
              : "등록된 예약금 내역이 없습니다."}
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">일자</TableHead>
                    <TableHead className="w-20">타입</TableHead>
                    <TableHead className="w-36">교육생</TableHead>
                    <TableHead className="w-24">코드</TableHead>
                    <TableHead className="w-40">교육원</TableHead>
                    <TableHead className="w-28 text-right">금액</TableHead>
                    <TableHead className="w-28 text-right">환불</TableHead>
                    <TableHead className="w-28">환불 일자</TableHead>
                    <TableHead>환불 사유</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-mono text-xs">
                        {r.date ? formatDate(r.date) : "—"}
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={r.type} />
                      </TableCell>
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
                      <TableCell className="text-sm">
                        {dash(r.centerName)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(r.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.refundAmount > 0
                          ? `−${formatCurrency(r.refundAmount)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.refundDate ? formatDate(r.refundDate) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.refundReason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                이전
              </button>
              <span className="text-sm text-muted-foreground">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: "교육" | "웰컴팩" }) {
  const cls =
    type === "교육"
      ? "bg-info/10 text-info border-info/20"
      : "bg-primary/10 text-primary border-primary/20";
  return (
    <Badge variant="outline" className={cls}>
      {type}
    </Badge>
  );
}
