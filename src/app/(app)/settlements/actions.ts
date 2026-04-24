"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/require-auth";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// 교육원×월 일괄 완료 처리
// =============================================================================

const completeBatchSchema = z.object({
  settlement_month: z.string().regex(/^\d{4}-\d{2}-01$/, "월 포맷은 YYYY-MM-01"),
  training_center_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        customer_id: z.string().uuid(),
        total_amount: z.number().int().nonnegative(),
        deduction_amount: z.number().int().nonnegative(),
      })
    )
    .min(1, "완료 대상이 없습니다."),
});

export type CompleteBatchInput = z.input<typeof completeBatchSchema>;

export async function completeSettlementBatch(
  input: CompleteBatchInput
): Promise<ActionResult<{ inserted: number }>> {
  const parsed = completeBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const rows = parsed.data.items.map((item) => ({
    customer_id: item.customer_id,
    training_center_id: parsed.data.training_center_id,
    settlement_month: parsed.data.settlement_month,
    total_amount: item.total_amount,
    deduction_amount: item.deduction_amount,
  }));

  const { error } = await supabase.from("commission_payments").insert(rows);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settlements");
  return { ok: true, data: { inserted: rows.length } };
}

// =============================================================================
// 교육원×월 일괄 되돌리기
// =============================================================================

const revertBatchSchema = z.object({
  settlement_month: z.string().regex(/^\d{4}-\d{2}-01$/, "월 포맷은 YYYY-MM-01"),
  training_center_id: z.string().uuid(),
});

export type RevertBatchInput = z.input<typeof revertBatchSchema>;

export async function revertSettlementBatch(
  input: RevertBatchInput
): Promise<ActionResult<{ deleted: number }>> {
  const parsed = revertBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error, count } = await supabase
    .from("commission_payments")
    .delete({ count: "exact" })
    .eq("settlement_month", parsed.data.settlement_month)
    .eq("training_center_id", parsed.data.training_center_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settlements");
  return { ok: true, data: { deleted: count ?? 0 } };
}
