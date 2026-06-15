import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * 토스 결제 successUrl 복귀 → 서버에서 confirm(시크릿) 검증 후 기록.
 *   1. 의도 금액(payment_transactions) 과 토스 amount 대조 (위변조 방지)
 *   2. 토스 /confirm 호출
 *   3. 가상계좌면 입금대기, 아니면 결제확정 기록
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const paymentKey = url.searchParams.get("paymentKey");
  const orderId = url.searchParams.get("orderId");
  const amount = Number(url.searchParams.get("amount"));
  const fail = (msg: string) => {
    const u = url.clone();
    u.pathname = "/pay/fail";
    u.search = `?message=${encodeURIComponent(msg)}`;
    return NextResponse.redirect(u);
  };

  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return fail("잘못된 요청");
  }

  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return fail("결제 설정 미완료");

  const admin = createAdminClient();

  // 1. 의도 금액 대조
  const { data: tx } = await admin
    .from("payment_transactions")
    .select("amount, status")
    .eq("toss_order_id", orderId)
    .maybeSingle();
  if (!tx) return fail("주문을 찾을 수 없음");
  if (tx.amount !== amount) return fail("결제 금액 불일치");

  // 2. 토스 confirm
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${secret}:`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return fail(data?.message ?? "결제 승인 실패");
  }

  // 3. 결제수단 매핑 + 가상계좌 분기
  const methodMap: Record<string, string> = {
    카드: "card",
    계좌이체: "transfer",
    가상계좌: "virtual_account",
  };
  const method = methodMap[data.method as string] ?? "card";

  const okUrl = url.clone();
  okUrl.search = "";

  if (data.status === "WAITING_FOR_DEPOSIT") {
    await admin.rpc("mark_payment_va_waiting", {
      p_order_id: orderId,
      p_payment_key: paymentKey,
      p_due: data.virtualAccount?.dueDate ?? null,
    });
    okUrl.pathname = "/my";
    okUrl.search = "?va=1";
    return NextResponse.redirect(okUrl);
  }

  await admin.rpc("record_payment_paid", {
    p_order_id: orderId,
    p_payment_key: paymentKey,
    p_method: method,
  });
  okUrl.pathname = "/my";
  okUrl.search = "?paid=1";
  return NextResponse.redirect(okUrl);
}
