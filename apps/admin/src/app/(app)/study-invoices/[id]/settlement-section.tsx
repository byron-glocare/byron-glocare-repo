"use client";

import { useActionState, useState } from "react";
import { Check, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  addSettlementAction,
  type AddSettlementState,
  deleteSettlementAction,
} from "../actions";

const CURRENCY_OPTIONS = ["KRW", "USD", "VND"];

export type Settlement = {
  id: string;
  amount: number;
  currency: string;
  received_at: string;
  bank_reference: string | null;
  attached_proof_url: string | null;
  note: string | null;
};

export function SettlementSection({
  invoiceId,
  currency,
  settlements,
  balance,
}: {
  invoiceId: string;
  currency: string;
  settlements: Settlement[];
  balance: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddSettlementState, FormData>(
    addSettlementAction,
    undefined
  );

  // 성공 시 (state === undefined) 폼 닫기
  if (state === undefined && pending === false && open && settlements.length === 0) {
    // 첫 등록 후 자동 닫지는 않음 (혼란 방지)
  }

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  return (
    <Card className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          송금 매칭 ({settlements.length})
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          <Plus className="size-4" />
          {open ? "취소" : "송금 기록"}
        </Button>
      </div>

      {/* 입력 폼 */}
      {open ? (
        <form action={action} className="space-y-3 rounded-md border bg-muted/30 p-4">
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="금액" error={fieldErr("amount")} required>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0"
                required
                defaultValue={balance > 0 ? String(balance) : ""}
                placeholder="원"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="통화">
              <select
                name="currency"
                required
                defaultValue={currency}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="입금일시" error={fieldErr("received_at")} required>
              <input
                type="datetime-local"
                name="received_at"
                required
                defaultValue={new Date().toISOString().slice(0, 16)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="입금자명 / 거래번호" full>
              <input
                type="text"
                name="bank_reference"
                maxLength={200}
                placeholder="예: GLOCARE-2026-01"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="증빙 URL" full>
              <input
                type="text"
                name="attached_proof_url"
                maxLength={500}
                placeholder="https://... (선택)"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="메모" full>
              <input
                type="text"
                name="note"
                maxLength={1000}
                placeholder="추가 메모 (선택)"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
          {state?.error ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  기록 중...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  송금 기록
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            전액 입금 시 인보이스 상태가 자동으로 &quot;납부 완료&quot; 로 변경됩니다.
          </p>
        </form>
      ) : null}

      {/* 송금 내역 */}
      {settlements.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 기록된 송금이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">입금일</th>
                <th className="px-3 py-2 text-right font-medium">금액</th>
                <th className="px-3 py-2 font-medium">입금자명 / 거래번호</th>
                <th className="px-3 py-2 font-medium">증빙</th>
                <th className="px-3 py-2 font-medium">메모</th>
                <th className="w-12 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 text-sm">
                    {new Date(s.received_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {s.amount.toLocaleString()} {s.currency}
                  </td>
                  <td className="px-3 py-2 text-sm">{s.bank_reference ?? "—"}</td>
                  <td className="px-3 py-2 text-sm">
                    {s.attached_proof_url ? (
                      <a
                        href={s.attached_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        보기
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {s.note ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <form
                      action={deleteSettlementAction.bind(null, s.id, invoiceId)}
                      onSubmit={(e) => {
                        if (
                          !confirm(
                            "정말 이 송금 기록을 삭제하시겠습니까? 납부 상태가 재계산됩니다."
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <button
                        type="submit"
                        className="text-destructive hover:opacity-70"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  error,
  full,
  required,
  children,
}: {
  label: string;
  error?: string;
  full?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-3" : ""}`}>
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
