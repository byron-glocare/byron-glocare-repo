import "server-only";

/**
 * 토스페이먼츠 연동 설정·승인.
 *
 * 키는 환경변수로만 받는다.
 *   NEXT_PUBLIC_TOSS_CLIENT_KEY  결제위젯(브라우저)에서 사용 — 공개돼도 되는 키
 *   TOSS_SECRET_KEY              결제 승인(서버) — 절대 클라이언트로 노출 금지
 *
 * 테스트 키(test_ck_… / test_sk_…)로 연동해도 카드사 심사가 가능하다.
 * 운영 전환 시 라이브 키로 교체하면 코드 변경 없이 동작한다.
 */

const CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

export function tossClientKey(): string {
  return (process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "").trim();
}

function tossSecretKey(): string {
  return (process.env.TOSS_SECRET_KEY ?? "").trim();
}

export function isTossConfigured(): boolean {
  return !!tossClientKey() && !!tossSecretKey();
}

export type TossConfirmResult =
  | {
      ok: true;
      paymentKey: string;
      orderId: string;
      /** 실제 승인된 금액 — 우리 주문 금액과 반드시 대조한다. */
      totalAmount: number;
      method: string | null;
      approvedAt: string | null;
      receiptUrl: string | null;
      raw: unknown;
    }
  | { ok: false; code: string; message: string };

/**
 * 결제 승인. 위젯이 돌려준 paymentKey·orderId·amount 를 그대로 넘긴다.
 *
 * 주의: amount 는 **서버가 계산한 주문 금액**을 넣어야 한다. 브라우저가 준 값을
 * 그대로 믿으면 금액을 조작당한다.
 */
export async function confirmTossPayment(input: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossConfirmResult> {
  const secret = tossSecretKey();
  if (!secret) {
    return { ok: false, code: "NO_SECRET_KEY", message: "결제 키가 설정되지 않았습니다." };
  }

  // 토스는 시크릿키를 Basic 인증의 사용자명으로 쓰고 비밀번호는 비운다.
  const auth = Buffer.from(`${secret}:`).toString("base64");

  let res: Response;
  try {
    res = await fetch(CONFIRM_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        // 같은 주문의 중복 승인 방지
        "Idempotency-Key": input.orderId,
      },
      body: JSON.stringify({
        paymentKey: input.paymentKey,
        orderId: input.orderId,
        amount: input.amount,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      code: "NETWORK",
      message: e instanceof Error ? e.message : "결제 승인 요청에 실패했습니다.",
    };
  }

  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!res.ok || !body) {
    return {
      ok: false,
      code: String(body?.code ?? res.status),
      message: String(body?.message ?? "결제 승인에 실패했습니다."),
    };
  }

  const receipt = body.receipt as { url?: string } | undefined;
  return {
    ok: true,
    paymentKey: String(body.paymentKey ?? input.paymentKey),
    orderId: String(body.orderId ?? input.orderId),
    totalAmount: Number(body.totalAmount ?? 0),
    method: body.method ? String(body.method) : null,
    approvedAt: body.approvedAt ? String(body.approvedAt) : null,
    receiptUrl: receipt?.url ?? null,
    raw: body,
  };
}
