"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { savePlanAction, type SavePlanState, deletePlanAction } from "./actions";

const MODEL_OPTIONS = [
  { value: "per_student", label: "학생당 (per_student)" },
  { value: "monthly", label: "월정액 (monthly)" },
  { value: "percentage", label: "비율 (percentage)" },
  { value: "hybrid", label: "혼합 (hybrid)" },
] as const;

const BASIS_OPTIONS = [
  { value: "", label: "—" },
  { value: "tuition", label: "등록금 기준" },
  { value: "total_paid", label: "납부 총액 기준" },
] as const;

const CURRENCY_OPTIONS = ["KRW", "USD", "VND"];

export type EditablePlan = {
  id: string;
  name: string;
  model: string;
  currency: string;
  per_student_fee: number | null;
  monthly_fee: number | null;
  percentage_rate: number | null;
  percentage_basis: string | null;
  hybrid_params: unknown;
  notes: string | null;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

export function PlanForm({ plan }: { plan?: EditablePlan }) {
  const isEdit = !!plan;
  const boundAction = isEdit ? savePlanAction.bind(null, plan!.id) : savePlanAction.bind(null, null);
  const [state, action, pending] = useActionState<SavePlanState, FormData>(
    boundAction,
    undefined
  );

  const [model, setModel] = useState<string>(plan?.model ?? "per_student");

  const fieldErr = (k: string) => state?.fieldErrors?.[k];

  return (
    <Card className="p-6">
      <form action={action} className="space-y-5">
        {/* 기본 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="플랜 이름" error={fieldErr("name")}>
            <input
              type="text"
              name="name"
              required
              maxLength={200}
              defaultValue={plan?.name ?? ""}
              placeholder="예: Standard 2026 Spring"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="청구 모델" error={fieldErr("model")}>
            <select
              name="model"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="통화">
            <select
              name="currency"
              required
              defaultValue={plan?.currency ?? "KRW"}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="활성 상태">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={plan?.is_active ?? true}
              />
              <span className="text-sm">활성 (유학센터에 할당 가능)</span>
            </label>
          </Field>
        </div>

        {/* 모델별 파라미터 */}
        <div className="rounded-md border border-dashed bg-muted/30 p-4 space-y-3">
          <div className="text-sm font-medium">모델 파라미터</div>

          {/* per_student / hybrid 일 때 학생당 요금 */}
          {(model === "per_student" || model === "hybrid") && (
            <Field
              label="학생당 요금 (필수)"
              error={fieldErr("per_student_fee")}
            >
              <input
                type="number"
                name="per_student_fee"
                step="0.01"
                min="0"
                defaultValue={plan?.per_student_fee ?? ""}
                placeholder="예: 500000"
                required={model === "per_student"}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          )}

          {/* monthly / hybrid 일 때 월정액 */}
          {(model === "monthly" || model === "hybrid") && (
            <Field
              label="월정액"
              error={fieldErr("monthly_fee")}
            >
              <input
                type="number"
                name="monthly_fee"
                step="0.01"
                min="0"
                defaultValue={plan?.monthly_fee ?? ""}
                placeholder="예: 2000000"
                required={model === "monthly"}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          )}

          {/* percentage / hybrid 일 때 비율 + 기준 */}
          {(model === "percentage" || model === "hybrid") && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="비율 (0.05 = 5%)"
                error={fieldErr("percentage_rate")}
              >
                <input
                  type="number"
                  name="percentage_rate"
                  step="0.0001"
                  min="0"
                  max="1"
                  defaultValue={plan?.percentage_rate ?? ""}
                  placeholder="예: 0.05"
                  required={model === "percentage"}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field
                label="비율 기준"
                error={fieldErr("percentage_basis")}
              >
                <select
                  name="percentage_basis"
                  defaultValue={plan?.percentage_basis ?? ""}
                  required={model === "percentage"}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {BASIS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* hybrid 일 때 추가 파라미터 JSON */}
          {model === "hybrid" && (
            <Field
              label="혼합 추가 파라미터 (JSON, 선택)"
              error={fieldErr("hybrid_params")}
            >
              <textarea
                name="hybrid_params"
                rows={4}
                defaultValue={
                  plan?.hybrid_params
                    ? JSON.stringify(plan.hybrid_params, null, 2)
                    : ""
                }
                placeholder='{"tier_thresholds": [10, 50]}'
                className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              />
            </Field>
          )}
        </div>

        {/* 유효 기간 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="효력 시작">
            <input
              type="date"
              name="effective_from"
              defaultValue={plan?.effective_from ?? ""}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="효력 종료">
            <input
              type="date"
              name="effective_to"
              defaultValue={plan?.effective_to ?? ""}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* 메모 */}
        <Field label="메모">
          <textarea
            name="notes"
            rows={3}
            defaultValue={plan?.notes ?? ""}
            placeholder="협상 사항·예외 케이스 등"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>

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
                  {isEdit ? "저장" : "플랜 등록"}
                </>
              )}
            </Button>
            <a
              href="/pricing-plans"
              className={buttonVariants({ variant: "outline" })}
            >
              취소
            </a>
          </div>
          {isEdit ? <DeleteButton planId={plan!.id} planName={plan!.name} /> : null}
        </div>
      </form>
    </Card>
  );
}

function DeleteButton({
  planId,
  planName,
}: {
  planId: string;
  planName: string;
}) {
  return (
    <form
      action={deletePlanAction.bind(null, planId)}
      onSubmit={(e) => {
        if (
          !confirm(
            `정말 "${planName}" 플랜을 삭제하시겠습니까? 할당된 유학센터는 플랜이 없는 상태가 됩니다.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="outline" className="text-destructive hover:bg-destructive/10">
        <Trash2 className="size-4" />
        삭제
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}
