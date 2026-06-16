"use client";

import { useMemo, useState } from "react";

import { SettlementPendingCenterRow } from "@/components/settlement-pending-center-row";
import {
  BulkConfirmAllPending,
  type BulkBucket,
} from "@/components/bulk-confirm-all-pending";
import { formatCurrency } from "@/lib/format";
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

type PendingGroup = {
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
  totalDeduction: number;
  totalNet: number;
};

type Props = {
  groups: PendingGroup[];
  settlementMonth: string; // YYYY-MM-01
  currentMonthLabel: string; // "YYYY-MM"
};

/**
 * 정산 예정 탭의 client wrapper.
 *
 * 모든 카드의 체크/공제 override state 를 한 곳에 보유 — 페이지 레벨
 * "도래분 일괄 확정" 버튼이 카드 안 사용자 변경을 라이브 반영하게 함.
 *
 * 각 카드 (`SettlementPendingCenterRow`) 는 controlled — props 의 state slice
 * 와 콜백만 사용.
 */
export function PendingTabClient({
  groups,
  settlementMonth,
  currentMonthLabel,
}: Props) {
  // centerId → { customerId → bool/number }
  const [checked, setChecked] = useState<
    Record<string, Record<string, boolean>>
  >(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const g of groups) {
      const inner: Record<string, boolean> = {};
      for (const r of g.rows) inner[r.customerId] = r.isDue;
      m[g.center.id] = inner;
    }
    return m;
  });
  const [overrides, setOverrides] = useState<
    Record<string, Record<string, number>>
  >(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const g of groups) {
      const inner: Record<string, number> = {};
      for (const r of g.rows) inner[r.customerId] = r.defaultDeduction;
      m[g.center.id] = inner;
    }
    return m;
  });

  // 전체 합계 (라이브) — 선택된 행 + 현재 override 기준
  const liveTotal = useMemo(() => {
    let sum = 0;
    for (const g of groups) {
      const centerChecked = checked[g.center.id] ?? {};
      const centerOver = overrides[g.center.id] ?? {};
      for (const r of g.rows) {
        if (!centerChecked[r.customerId]) continue;
        const d = centerOver[r.customerId] ?? r.defaultDeduction;
        sum += Math.max(0, r.tuitionBase - d);
      }
    }
    return sum;
  }, [groups, checked, overrides]);

  // 일괄 확정 버튼이 사용할 buckets — 카드별 *현재* 선택/공제 반영
  const bulkBuckets: BulkBucket[] = useMemo(() => {
    return groups
      .map((g) => {
        const centerChecked = checked[g.center.id] ?? {};
        const centerOver = overrides[g.center.id] ?? {};
        const selectedRows = g.rows
          .filter((r) => centerChecked[r.customerId])
          .map((r) => ({
            customerId: r.customerId,
            customerName: r.customerName,
            tuitionBase: r.tuitionBase,
            defaultDeduction: centerOver[r.customerId] ?? r.defaultDeduction,
          }));
        return {
          centerId: g.center.id,
          centerName: g.center.name,
          rows: selectedRows,
        };
      })
      .filter((b) => b.rows.length > 0);
  }, [groups, checked, overrides]);

  return (
    <>
      <div className="flex items-center justify-between px-1 gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          기준 <span className="font-mono">{currentMonthLabel}</span> 말까지 정산
          예정일 도래 · 과거 누적 미정산 포함
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            선택 합계{" "}
            <span className="font-semibold">{formatCurrency(liveTotal)}</span>
          </div>
          <BulkConfirmAllPending
            settlementMonth={settlementMonth}
            buckets={bulkBuckets}
          />
        </div>
      </div>
      {groups.map((group) => (
        <SettlementPendingCenterRow
          key={group.center.id}
          center={group.center}
          rows={group.rows}
          totalBase={group.totalBase}
          totalDefaultDeduction={group.totalDeduction}
          totalNet={group.totalNet}
          settlementMonth={settlementMonth}
          checked={checked[group.center.id] ?? {}}
          overrides={overrides[group.center.id] ?? {}}
          onCheckedChange={(customerId, v) => {
            setChecked((prev) => ({
              ...prev,
              [group.center.id]: {
                ...(prev[group.center.id] ?? {}),
                [customerId]: v,
              },
            }));
          }}
          onCheckedReplace={(next) => {
            setChecked((prev) => ({ ...prev, [group.center.id]: next }));
          }}
          onOverrideChange={(customerId, v) => {
            setOverrides((prev) => ({
              ...prev,
              [group.center.id]: {
                ...(prev[group.center.id] ?? {}),
                [customerId]: v,
              },
            }));
          }}
        />
      ))}
    </>
  );
}
