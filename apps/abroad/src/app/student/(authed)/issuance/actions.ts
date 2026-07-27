"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";

const orderSchema = z.object({
  universityId: z
    .union([z.coerce.number().int().positive(), z.null()])
    .optional(),
  items: z
    .array(
      z.object({
        pricingId: z.string().uuid(),
        qty: z.coerce.number().int().min(1).max(20),
      })
    )
    .min(1),
});

export type CreateOrderState = { error?: string } | undefined;

/**
 * 발급대행 주문 생성 (결제 직전).
 *   가격은 서버에서 단가표를 다시 읽어 계산(클라이언트 값 신뢰 안 함).
 *   status='payment_pending' → 결제(P4)로 이어짐.
 */
export async function createIssuanceOrderAction(input: {
  universityId: number | null;
  items: Array<{ pricingId: string; qty: number }>;
}): Promise<CreateOrderState> {
  const session = await verifyStudentSession();

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "선택한 항목을 확인해 주세요." };
  }
  const { universityId, items } = parsed.data;
  const supabase = await createClient();

  // 단가표 재조회 → 가격 확정
  const ids = Array.from(new Set(items.map((i) => i.pricingId)));
  const { data: pricing, error: pErr } = await supabase
    .from("study_issuance_pricing")
    .select("id, label_ko, notarization, unit_price, proxy_unavailable_surcharge, is_active")
    .in("id", ids);
  if (pErr) return { error: pErr.message };
  const priceMap = new Map((pricing ?? []).map((p) => [p.id, p]));

  const lineItems = items
    .map((i) => {
      const p = priceMap.get(i.pricingId);
      if (!p || !p.is_active) return null;
      return {
        pricing_id: p.id,
        label_ko: p.label_ko,
        notarization: p.notarization,
        unit_price: p.unit_price,
        proxy_surcharge: p.proxy_unavailable_surcharge,
        qty: i.qty,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (lineItems.length === 0) {
    return { error: "신청 가능한 항목이 없습니다." };
  }
  const subtotal = lineItems.reduce(
    (sum, it) => sum + it.unit_price * it.qty,
    0
  );

  // 주문 생성 (RLS sio_access: 본인 학생만)
  const { data: order, error: oErr } = await supabase
    .from("study_issuance_orders")
    .insert({
      student_id: session.student.id,
      university_id: universityId ?? null,
      status: "payment_pending",
      subtotal,
    })
    .select("id")
    .single();
  if (oErr || !order) {
    return { error: `주문 생성 실패: ${oErr?.message ?? "알 수 없음"}` };
  }

  const { error: iErr } = await supabase
    .from("study_issuance_order_items")
    .insert(lineItems.map((it) => ({ ...it, order_id: order.id })));
  if (iErr) {
    // 항목 저장 실패 → 빈 주문 정리(베스트 에포트)
    await supabase.from("study_issuance_orders").delete().eq("id", order.id);
    return { error: `주문 항목 저장 실패: ${iErr.message}` };
  }

  redirect(`/student/issuance/${order.id}`);
}
