"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateIssuanceOrderAction,
  cancelIssuanceOrderAction,
  uploadResultPdfAction,
  getResultPdfUrlAction,
} from "./actions";
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from "../status";

export function OrderControls({
  id,
  status,
  etaDate,
  managerNote,
  resultPdfPath,
  cancelled,
}: {
  id: string;
  status: string;
  etaDate: string | null;
  managerNote: string | null;
  resultPdfPath: string | null;
  cancelled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [st, setSt] = useState(status);
  const [eta, setEta] = useState(etaDate ?? "");
  const [note, setNote] = useState(managerNote ?? "");
  const [reason, setReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(r.error ?? "실패");
      }
    });

  return (
    <div className="space-y-4">
      {/* 상태 */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs text-muted-foreground">진행 상태</span>
          <select
            value={st}
            onChange={(e) => setSt(e.target.value)}
            disabled={cancelled}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() =>
            run(
              () => updateIssuanceOrderAction({ id, status: st }),
              "상태를 변경했습니다."
            )
          }
          disabled={pending || cancelled}
        >
          상태 저장
        </Button>
      </div>

      {/* ETA */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs text-muted-foreground">
            발급 완료 예정일 (고객 노출)
          </span>
          <Input
            type="date" min="1900-01-01" max="2100-12-31"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          onClick={() =>
            run(
              () =>
                updateIssuanceOrderAction({ id, eta_date: eta || null }),
              "예정일을 저장했습니다."
            )
          }
          disabled={pending}
        >
          예정일 저장
        </Button>
      </div>

      {/* 메모 */}
      <div>
        <span className="mb-1 block text-xs text-muted-foreground">
          담당자 메모 (고객 노출)
        </span>
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="진행 안내·필요 서류 등"
        />
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run(
                () =>
                  updateIssuanceOrderAction({ id, manager_note: note || null }),
                "메모를 저장했습니다."
              )
            }
            disabled={pending}
          >
            메모 저장
          </Button>
        </div>
      </div>

      {/* 발급 결과 PDF */}
      <div className="rounded-lg border border-border p-3">
        <span className="mb-1 block text-xs text-muted-foreground">
          발급 결과 PDF
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="text-sm" />
          <Button
            size="sm"
            onClick={() => {
              const f = fileRef.current?.files?.[0];
              if (!f) return toast.error("파일을 선택하세요.");
              const fd = new FormData();
              fd.set("orderId", id);
              fd.set("file", f);
              run(() => uploadResultPdfAction(fd), "업로드했습니다.");
            }}
            disabled={pending}
          >
            업로드
          </Button>
          {resultPdfPath ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                start(async () => {
                  const r = await getResultPdfUrlAction(resultPdfPath);
                  if (r.ok) window.open(r.url, "_blank");
                  else toast.error(r.error);
                })
              }
              disabled={pending}
            >
              현재 파일 보기
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">업로드된 파일 없음</span>
          )}
        </div>
      </div>

      {/* 취소 */}
      {!cancelled && (
        <div className="rounded-lg border border-destructive/30 p-3">
          <span className="mb-1 block text-xs text-muted-foreground">
            주문 취소
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="취소 사유"
              className="flex-1 min-w-[180px]"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!confirm("이 주문을 취소할까요?")) return;
                run(
                  () => cancelIssuanceOrderAction({ id, reason }),
                  "주문을 취소했습니다."
                );
              }}
              disabled={pending}
            >
              주문 취소
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
