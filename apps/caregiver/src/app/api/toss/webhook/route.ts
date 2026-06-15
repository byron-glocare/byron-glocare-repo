import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * 토스 웹훅 — 주로 가상계좌 입금완료(DEPOSIT_CALLBACK) 처리.
 * 웹훅 본문을 신뢰하지 않고, orderId 로 토스에 재조회해 status=DONE 확인 후 기록.
 *
 * ⚠️ 로컬에선 토스가 이 URL 에 못 닿음 → 배포 후 동작.
 *   Toss 대시보드에 웹훅 URL = https://<도메인>/api/toss/webhook 등록.
 */
export async function POST(request: Request) {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "no secret" }, { status: 500 });

  let body: { eventType?: string; data?: { orderId?: string; paymentKey?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const orderId = body.data?.orderId;
  if (!orderId) return NextResponse.json({ ok: true }); // 무관 이벤트

  // 토스에 재조회 (신뢰 검증)
  const res = await fetch(
    `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderId)}`,
    {
      headers: {
        Authorization: "Basic " + Buffer.from(`${secret}:`).toString("base64"),
      },
    }
  );
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return NextResponse.json({ ok: true });

  if (data.status === "DONE") {
    const methodMap: Record<string, string> = {
      카드: "card",
      계좌이체: "transfer",
      가상계좌: "virtual_account",
    };
    const admin = createAdminClient();
    await admin.rpc("record_payment_paid", {
      p_order_id: orderId,
      p_payment_key: data.paymentKey ?? body.data?.paymentKey ?? "",
      p_method: methodMap[data.method as string] ?? "virtual_account",
    });
  }

  return NextResponse.json({ ok: true });
}
