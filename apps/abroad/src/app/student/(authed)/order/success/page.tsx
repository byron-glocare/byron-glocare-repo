/**
 * /student/order/success — 토스가 결제 인증 후 돌려보내는 곳.
 *
 * 여기서 **서버가 승인(confirm)** 을 호출해야 결제가 확정된다.
 * 승인 전에 반드시 우리 주문의 금액과 토스가 준 금액을 대조한다 —
 * 브라우저가 넘긴 amount 를 그대로 믿으면 금액을 조작당한다.
 */

import Link from "next/link";

import { verifyStudentSession } from "@/lib/student/dal";
import { createClient } from "@/lib/supabase/server";
import { confirmTossPayment } from "@/lib/payments/toss";
import { won } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const paymentKey = one(sp.paymentKey) ?? "";
  const tossOrderId = one(sp.orderId) ?? "";

  const session = await verifyStudentSession();
  const supabase = await createClient();

  let error: string | null = null;
  let paid: { amount: number; method: string | null; receiptUrl: string | null } | null =
    null;

  if (!paymentKey || !tossOrderId) {
    error = "결제 정보가 올바르지 않습니다.";
  } else {
    const { data: order } = await supabase
      .from("study_issuance_orders")
      .select("id, student_id, subtotal, status, paid_at")
      .eq("toss_order_id", tossOrderId)
      .maybeSingle();

    if (!order || order.student_id !== session.student.id) {
      error = "주문을 찾을 수 없습니다.";
    } else if (order.paid_at) {
      // 새로고침 등으로 이미 승인된 경우 — 다시 승인하지 않는다.
      paid = { amount: order.subtotal, method: null, receiptUrl: null };
    } else {
      const res = await confirmTossPayment({
        paymentKey,
        orderId: tossOrderId,
        amount: order.subtotal, // 서버가 확정한 금액으로만 승인
      });

      if (!res.ok) {
        error = res.message;
        await supabase
          .from("study_issuance_orders")
          .update({ manager_note: `결제 승인 실패(${res.code}): ${res.message}` })
          .eq("id", order.id);
      } else if (res.totalAmount !== order.subtotal) {
        error = "결제 금액이 주문 금액과 일치하지 않습니다. 고객센터로 문의해 주세요.";
      } else {
        await supabase
          .from("study_issuance_orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            payment_transaction_id: res.paymentKey,
          })
          .eq("id", order.id);
        paid = {
          amount: res.totalAmount,
          method: res.method,
          receiptUrl: res.receiptUrl,
        };
      }
    }
  }

  return (
    <div className="space-y-5">
      {paid ? (
        <>
          <div className="gc-success">
            <div className="gc-success-eyebrow">결제 완료</div>
            <div className="gc-success-title">
              {won(paid.amount)} 결제가 완료되었습니다
            </div>
            <div className="gc-success-desc">
              담당자가 배정되면 진행 상황을 안내해 드립니다.
            </div>
          </div>

          <div className="gc-card">
            <dl className="product-terms" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
              <div>
                <dt>결제 금액</dt>
                <dd className="gc-mono">{won(paid.amount)}</dd>
              </div>
              {paid.method ? (
                <div>
                  <dt>결제 수단</dt>
                  <dd>{paid.method}</dd>
                </div>
              ) : null}
              {paid.receiptUrl ? (
                <div>
                  <dt>영수증</dt>
                  <dd>
                    <a href={paid.receiptUrl} target="_blank" rel="noreferrer">
                      영수증 보기
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/student/issuance" className="gc-btn gc-btn-primary gc-btn-md">
              내 신청 내역
            </Link>
            <Link href="/student" className="gc-btn gc-btn-secondary gc-btn-md">
              홈으로
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="gc-page-title">결제를 완료하지 못했습니다</h1>
          <div className="gc-note" style={{ background: "var(--gc-error-bg)", color: "var(--gc-error)" }}>
            {error}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/service" className="gc-btn gc-btn-secondary gc-btn-md">
              서비스 안내로
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
