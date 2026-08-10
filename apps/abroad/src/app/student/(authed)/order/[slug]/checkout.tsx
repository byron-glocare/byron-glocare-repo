"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/**
 * 토스 결제위젯 — 결제수단 선택 + 약관 동의 + 결제 요청.
 *
 * 금액은 서버가 확정한 값을 그대로 받아 쓰고, 승인도 서버에서 다시 대조한다.
 * (브라우저 값만 믿으면 금액을 조작당한다.)
 */

type TossWidgets = {
  setAmount: (a: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (o: {
    selector: string;
    variantKey?: string;
  }) => Promise<unknown>;
  renderAgreement: (o: {
    selector: string;
    variantKey?: string;
  }) => Promise<unknown>;
  requestPayment: (o: Record<string, unknown>) => Promise<void>;
};

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      widgets: (o: { customerKey: string }) => TossWidgets;
    };
  }
}

export function Checkout({
  clientKey,
  customerKey,
  tossOrderId,
  orderName,
  amount,
  customerName,
  customerEmail,
  origin,
}: {
  clientKey: string;
  customerKey: string;
  tossOrderId: string;
  orderName: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  origin: string;
}) {
  const [ready, setReady] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const widgetsRef = useRef<TossWidgets | null>(null);

  useEffect(() => {
    if (!sdkLoaded || widgetsRef.current) return;
    const TossPayments = window.TossPayments;
    if (!TossPayments) return;

    let cancelled = false;
    (async () => {
      try {
        const widgets = TossPayments(clientKey).widgets({ customerKey });
        widgetsRef.current = widgets;
        await widgets.setAmount({ currency: "KRW", value: amount });
        await Promise.all([
          widgets.renderPaymentMethods({
            selector: "#toss-payment-methods",
            variantKey: "DEFAULT",
          }),
          widgets.renderAgreement({
            selector: "#toss-agreement",
            variantKey: "AGREEMENT",
          }),
        ]);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setErr(
            e instanceof Error ? e.message : "결제창을 불러오지 못했습니다."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdkLoaded, clientKey, customerKey, amount]);

  async function pay() {
    const widgets = widgetsRef.current;
    if (!widgets) return;
    setBusy(true);
    setErr(null);
    try {
      await widgets.requestPayment({
        orderId: tossOrderId,
        orderName,
        customerName,
        customerEmail,
        successUrl: `${origin}/student/order/success`,
        failUrl: `${origin}/student/order/fail`,
      });
      // 성공 시 토스가 successUrl 로 이동시킨다 — 여기로 돌아오지 않는다.
    } catch (e) {
      setBusy(false);
      const msg = e instanceof Error ? e.message : "결제를 시작하지 못했습니다.";
      // 사용자가 결제창을 닫은 경우는 오류로 보지 않는다.
      if (!/사용자|cancel|취소/i.test(msg)) setErr(msg);
    }
  }

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v2/standard"
        strategy="afterInteractive"
        onLoad={() => setSdkLoaded(true)}
        onError={() => setErr("결제 모듈을 불러오지 못했습니다.")}
      />

      <div id="toss-payment-methods" />
      <div id="toss-agreement" />

      {err ? (
        <p className="gc-error-msg">
          <span aria-hidden>!</span>
          <span>{err}</span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={pay}
        disabled={!ready || busy}
        className="gc-btn gc-btn-primary gc-btn-lg gc-btn-block"
        style={{ marginTop: 16 }}
      >
        {busy
          ? "결제창 여는 중…"
          : ready
            ? `${amount.toLocaleString("ko-KR")}원 결제하기`
            : "결제창 불러오는 중…"}
      </button>
    </>
  );
}
