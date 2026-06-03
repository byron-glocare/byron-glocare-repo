"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  saveInvoiceAction,
  type SaveInvoiceState,
  deleteInvoiceAction,
} from "./actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "초안" },
  { value: "sent", label: "발송됨" },
  { value: "paid", label: "납부 완료" },
  { value: "cancelled", label: "취소" },
] as const;

const CURRENCY_OPTIONS = ["KRW", "USD", "VND"];

export type LineItem = {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
};

export type EditableInvoice = {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  line_items: LineItem[];
  total_amount: number;
  currency: string;
  status: string;
  tax_invoice_url: string | null;
};

export type OrgOption = {
  id: string;
  name_vi: string;
  name_ko: string | null;
  pricing_plan_id: string | null;
  pricing_plan?: { name: string; model: string } | null;
};

export function InvoiceForm({
  invoice,
  orgs,
}: {
  invoice?: EditableInvoice;
  orgs: OrgOption[];
}) {
  const isEdit = !!invoice;
  const boundAction = isEdit
    ? saveInvoiceAction.bind(null, invoice!.id)
    : saveInvoiceAction.bind(null, null);
  const [state, action, pending] = useActionState<SaveInvoiceState, FormData>(
    boundAction,
    undefined
  );

  const [items, setItems] = useState<LineItem[]>(
    invoice?.line_items ?? [
      { description: "", qty: 1, unit_price: 0, amount: 0 },
    ]
  );

  const total = useMemo(
    () => items.reduce((s, i) => s + (Number(i.amount) || 0), 0),
    [items]
  );

  const updateItem = (idx: number, field: keyof LineItem, value: string) => {
    setItems((cur) =>
      cur.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it };
        if (field === "description") {
          next.description = value;
        } else {
          const n = Number(value) || 0;
          next[field] = n;
          // qty 또는 unit_price 변경 시 amount 자동 계산
          if (field === "qty" || field === "unit_price") {
            next.amount = next.qty * next.unit_price;
          }
        }
        return next;
      })
    );
  };

  const addItem = () =>
    setItems([...items, { description: "", qty: 1, unit_price: 0, amount: 0 }]);
  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        {/* 메타 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="유학센터 회사" error={fieldErr("org_id")} required>
            <select
              name="org_id"
              required
              defaultValue={invoice?.org_id ?? ""}
              disabled={isEdit}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— 선택 —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name_vi}
                  {o.name_ko ? ` · ${o.name_ko}` : ""}
                  {o.pricing_plan ? ` — ${o.pricing_plan.name}` : " (플랜 없음)"}
                </option>
              ))}
            </select>
            {isEdit ? (
              <span className="text-xs text-muted-foreground">
                회사 변경은 새 인보이스로.
              </span>
            ) : null}
          </Field>

          <Field label="상태" error={fieldErr("status")}>
            <select
              name="status"
              required
              defaultValue={invoice?.status ?? "draft"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              draft→sent 변경 시 sent_at 자동 stamping.
            </span>
          </Field>

          <Field label="기간 시작" error={fieldErr("period_start")} required>
            <input
              type="date"
              name="period_start"
              required
              defaultValue={invoice?.period_start ?? ""}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="기간 종료" error={fieldErr("period_end")} required>
            <input
              type="date"
              name="period_end"
              required
              defaultValue={invoice?.period_end ?? ""}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="통화">
            <select
              name="currency"
              required
              defaultValue={invoice?.currency ?? "KRW"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="세금계산서 URL" full>
            <input
              type="text"
              name="tax_invoice_url"
              defaultValue={invoice?.tax_invoice_url ?? ""}
              placeholder="https://... (선택)"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* 라인 아이템 */}
        <div className="rounded-md border border-dashed bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">청구 항목</div>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="size-4" />
              항목 추가
            </Button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">항목이 없습니다.</p>
          ) : (
            <div className="overflow-hidden rounded-md border bg-background">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">내역</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">수량</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">단가</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">금액</th>
                    <th className="w-12 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={it.description}
                          onChange={(e) =>
                            updateItem(idx, "description", e.target.value)
                          }
                          placeholder="예: 2026 Spring 입학 지원 학생 5명"
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          value={it.qty}
                          min="0"
                          step="1"
                          onChange={(e) =>
                            updateItem(idx, "qty", e.target.value)
                          }
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          value={it.unit_price}
                          min="0"
                          step="0.01"
                          onChange={(e) =>
                            updateItem(idx, "unit_price", e.target.value)
                          }
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          value={it.amount}
                          min="0"
                          step="0.01"
                          onChange={(e) =>
                            updateItem(idx, "amount", e.target.value)
                          }
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-right font-medium"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-destructive hover:opacity-70"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-2 text-right font-medium">
                      합계
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {total.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* 직렬화된 hidden input */}
          <input
            type="hidden"
            name="line_items"
            value={JSON.stringify(items)}
          />
          <input
            type="hidden"
            name="total_amount"
            value={String(total)}
          />
        </div>

        {state?.error ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {isEdit ? "저장" : "인보이스 발행"}
                </>
              )}
            </Button>
            <a
              href={isEdit ? `/study-invoices/${invoice!.id}` : "/study-invoices"}
              className={buttonVariants({ variant: "outline" })}
            >
              취소
            </a>
          </div>
          {isEdit ? (
            <DeleteButton invoiceId={invoice!.id} />
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function DeleteButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form
      action={deleteInvoiceAction.bind(null, invoiceId)}
      onSubmit={(e) => {
        if (
          !confirm(
            "정말 이 인보이스를 삭제하시겠습니까? 매칭된 송금이 있으면 삭제할 수 없습니다."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        삭제
      </Button>
    </form>
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
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
