"use server";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { productBySlug } from "@/lib/products";

/**
 * 상품 1건 주문 생성 (결제 직전).
 *
 * 금액은 **서버가 단가표에서 다시 읽어** 확정한다. 브라우저가 보낸 값은 쓰지 않는다.
 * 같은 상품으로 아직 결제되지 않은 주문이 있으면 새로 만들지 않고 재사용해
 * 결제창을 여러 번 열어도 주문이 쌓이지 않게 한다.
 */
export async function ensureProductOrder(slug: string): Promise<
  | {
      ok: true;
      orderId: string;
      tossOrderId: string;
      amount: number;
      orderName: string;
    }
  | { ok: false; error: string }
> {
  const product = productBySlug(slug);
  if (!product) return { ok: false, error: "존재하지 않는 상품입니다." };

  const session = await verifyStudentSession();
  const supabase = await createClient();

  const { data: price, error: pErr } = await supabase
    .from("study_issuance_pricing")
    .select("id, label_ko, notarization, unit_price, is_active")
    .eq("std_key", product.key)
    .eq("is_active", true)
    .maybeSingle();
  if (pErr) return { ok: false, error: pErr.message };
  if (!price) return { ok: false, error: "판매 중인 상품이 아닙니다." };

  const amount = price.unit_price;

  // 결제 대기 중인 같은 상품 주문이 있으면 재사용
  const { data: existing } = await supabase
    .from("study_issuance_orders")
    .select("id, toss_order_id, subtotal, status")
    .eq("student_id", session.student.id)
    .in("status", ["draft", "payment_pending"])
    .order("created_at", { ascending: false });

  for (const o of existing ?? []) {
    const { data: items } = await supabase
      .from("study_issuance_order_items")
      .select("pricing_id")
      .eq("order_id", o.id);
    const single =
      (items ?? []).length === 1 && items?.[0]?.pricing_id === price.id;
    if (single && o.toss_order_id) {
      // 금액이 바뀌었으면 최신 단가로 맞춘다
      if (o.subtotal !== amount) {
        await supabase
          .from("study_issuance_orders")
          .update({ subtotal: amount })
          .eq("id", o.id);
      }
      return {
        ok: true,
        orderId: o.id,
        tossOrderId: o.toss_order_id,
        amount,
        orderName: product.name,
      };
    }
  }

  // 토스 주문번호 — 영문·숫자·하이픈 6~64자. 우리 주문과 1:1.
  const tossOrderId = `gc_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const { data: order, error: oErr } = await supabase
    .from("study_issuance_orders")
    .insert({
      student_id: session.student.id,
      university_id: null,
      status: "payment_pending",
      subtotal: amount,
      toss_order_id: tossOrderId,
    })
    .select("id")
    .single();
  if (oErr || !order) {
    return { ok: false, error: oErr?.message ?? "주문 생성에 실패했습니다." };
  }

  const { error: iErr } = await supabase
    .from("study_issuance_order_items")
    .insert({
      order_id: order.id,
      pricing_id: price.id,
      label_ko: price.label_ko,
      notarization: price.notarization,
      unit_price: amount,
      qty: 1,
    });
  if (iErr) return { ok: false, error: iErr.message };

  return {
    ok: true,
    orderId: order.id,
    tossOrderId,
    amount,
    orderName: product.name,
  };
}
