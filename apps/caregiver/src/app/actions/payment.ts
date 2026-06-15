"use server";

import { createClient } from "@/lib/supabase/server";

export type IntentResult =
  | { ok: true; orderId: string; amount: number; clientKey: string }
  | { ok: false; error: string };

/**
 * 결제 의도 생성 — create_payment_intent RPC (금액은 서버가 결정, 위조 불가).
 */
export async function createPaymentIntent(kind: string): Promise<IntentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login required" };

  const { data, error } = await supabase.rpc("create_payment_intent", {
    p_kind: kind,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return { ok: false, error: error?.message ?? "intent failed" };
  }

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
  return {
    ok: true,
    orderId: row.order_id as string,
    amount: row.amount as number,
    clientKey,
  };
}
