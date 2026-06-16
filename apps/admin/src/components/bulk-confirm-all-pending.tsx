"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

import { completeSettlementBatch } from "@/app/(app)/settlements/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";

export type BulkBucket = {
  centerId: string;
  centerName: string;
  /** isDue 인 행만 (도래 한 정산 예정) */
  rows: {
    customerId: string;
    customerName: string;
    tuitionBase: number;
    defaultDeduction: number;
  }[];
};

type Props = {
  settlementMonth: string; // YYYY-MM-01
  buckets: BulkBucket[];
};

/**
 * 정산 예정 페이지 상단 — 전 교육원의 *도래한* 행 일괄 확정 버튼.
 *
 * 카드별 사용자 커스터마이즈 (체크 해제·공제 override) 는 *무시* 함.
 * 카드 각자의 state 가 client island 라 페이지 레벨에서 접근 불가 +
 * default 동작이 가장 안전 (사용자가 일부 커스터마이즈만 필요하면 카드 안에서).
 *
 * 처리: 각 center 별로 completeSettlementBatch 호출 (Promise.all). 한 center
 * 실패해도 다른 center 영향 X.
 */
export function BulkConfirmAllPending({ settlementMonth, buckets }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const totalCount = buckets.reduce((s, b) => s + b.rows.length, 0);
  const totalNet = buckets.reduce(
    (s, b) =>
      s +
      b.rows.reduce(
        (rs, r) => rs + Math.max(0, r.tuitionBase - r.defaultDeduction),
        0
      ),
    0
  );

  function handleConfirm() {
    if (buckets.length === 0 || totalCount === 0) {
      toast.error("도래한 정산 예정 행이 없습니다.");
      return;
    }
    startTransition(async () => {
      const results = await Promise.all(
        buckets.map(async (b) => ({
          bucket: b,
          result: await completeSettlementBatch({
            settlement_month: settlementMonth,
            training_center_id: b.centerId,
            status: "confirmed",
            items: b.rows.map((r) => ({
              customer_id: r.customerId,
              total_amount: r.tuitionBase,
              deduction_amount: Math.max(0, Math.round(r.defaultDeduction)),
            })),
          }),
        }))
      );

      const succeeded = results.filter((x) => x.result.ok);
      const failed = results.filter((x) => !x.result.ok);
      const insertedTotal = succeeded.reduce(
        (s, x) => s + (x.result.ok ? x.result.data.inserted : 0),
        0
      );

      if (failed.length === 0) {
        toast.success(
          `${succeeded.length}개 교육원 (${insertedTotal}명) 일괄 확정 완료. 정산 내역 발송 페이지로 이동합니다.`
        );
        setOpen(false);
        router.push("/sms/commission");
      } else {
        const failedNames = failed
          .map(
            (x) =>
              `${x.bucket.centerName}${
                x.result.ok ? "" : `: ${x.result.error}`
              }`
          )
          .join("\n");
        toast.warning(
          `${succeeded.length}/${results.length}개 교육원 성공. 실패 ${failed.length}개:\n${failedNames}`,
          { duration: 10000 }
        );
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={pending || totalCount === 0}
        title={
          totalCount === 0
            ? "선택된 행이 없습니다 (카드 안에서 체크하세요)"
            : undefined
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileText className="size-4" />
        )}
        선택 일괄 확정 ({totalCount}명 · {formatCurrency(totalNet)})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>선택한 정산 예정 일괄 확정</DialogTitle>
            <DialogDescription>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-foreground">
                    {buckets.length}개 교육원 · 총 {totalCount}명
                  </span>{" "}
                  의 정산을 한 번에 확정합니다 (카드 안 체크·공제 변경 그대로 반영).
                </div>
                <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  대상 교육원:
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {buckets.map((b) => (
                      <li key={b.centerId}>
                        {b.centerName} — {b.rows.length}명
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-sm pt-2 border-t border-border">
                  총 정산액:{" "}
                  <span className="font-semibold font-mono">
                    {formatCurrency(totalNet)}
                  </span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              확인 — 일괄 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
