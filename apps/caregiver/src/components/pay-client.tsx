"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { createPaymentIntent } from "@/app/actions/payment";

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      widgets: (opts: { customerKey: string }) => TossWidgets;
      ANONYMOUS?: string;
    };
  }
}
type TossWidgets = {
  setAmount: (a: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (o: { selector: string; variantKey?: string }) => Promise<void>;
  renderAgreement: (o: { selector: string }) => Promise<void>;
  requestPayment: (o: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
};

const ORDER_NAMES: Record<string, string> = {
  education_reservation: "글로케어 교육 예약금",
  welcomepack_reservation: "글로케어 취업 예약금",
  welcomepack_interim: "글로케어 비자 수수료",
  welcomepack_balance: "글로케어 잔금",
};

function loadTossScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) return resolve();
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v2/standard";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("toss sdk load failed"));
    document.head.appendChild(s);
  });
}

export function PayClient() {
  const sp = useSearchParams();
  const kind = sp.get("kind") ?? "education_reservation";
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const widgetsRef = useRef<TossWidgets | null>(null);
  const orderRef = useRef<{ orderId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const intent = await createPaymentIntent(kind);
      if (cancelled) return;
      if (!intent.ok) return setError(intent.error);
      if (!intent.clientKey) return setError("결제 설정 미완료 (TOSS 키 없음)");
      try {
        await loadTossScript();
        const toss = window.TossPayments!(intent.clientKey);
        const widgets = toss.widgets({ customerKey: toss.ANONYMOUS ?? "ANONYMOUS" });
        await widgets.setAmount({ currency: "KRW", value: intent.amount });
        await widgets.renderPaymentMethods({ selector: "#payment-method" });
        await widgets.renderAgreement({ selector: "#agreement" });
        widgetsRef.current = widgets;
        orderRef.current = { orderId: intent.orderId };
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  async function onPay() {
    const widgets = widgetsRef.current;
    const order = orderRef.current;
    if (!widgets || !order) return;
    const origin = window.location.origin;
    await widgets.requestPayment({
      orderId: order.orderId,
      orderName: ORDER_NAMES[kind] ?? "글로케어 결제",
      successUrl: `${origin}/pay/success`,
      failUrl: `${origin}/pay/fail`,
    });
  }

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 560 }}>
      <h1 className="page-title">{ORDER_NAMES[kind] ?? "결제"}</h1>
      {error && <p style={{ color: "var(--coral-d)", fontSize: "0.9rem" }}>{error}</p>}
      <div id="payment-method" />
      <div id="agreement" />
      {ready && (
        <button
          type="button"
          onClick={onPay}
          style={{
            width: "100%",
            background: "var(--coral)",
            color: "var(--white)",
            fontWeight: 700,
            padding: "0.9rem",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            marginTop: "1rem",
          }}
        >
          결제하기
        </button>
      )}
    </div>
  );
}
