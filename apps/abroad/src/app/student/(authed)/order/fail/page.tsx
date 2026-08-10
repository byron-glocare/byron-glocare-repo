/**
 * /student/order/fail — 결제 실패·취소 시 토스가 돌려보내는 곳.
 * 주문은 payment_pending 으로 남아 있어 같은 상품을 다시 결제하면 재사용된다.
 */

import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrderFailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const code = one(sp.code) ?? "";
  const message = one(sp.message) ?? "결제가 완료되지 않았습니다.";

  const cancelled = /USER_CANCEL|PAY_PROCESS_CANCELED/i.test(code);

  return (
    <div className="space-y-5">
      <h1 className="gc-page-title">
        {cancelled ? "결제를 취소했습니다" : "결제를 완료하지 못했습니다"}
      </h1>
      <p className="gc-page-desc">{message}</p>

      {!cancelled && code ? (
        <p className="gc-hint gc-mono">오류 코드: {code}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/service" className="gc-btn gc-btn-primary gc-btn-md">
          다시 시도하기
        </Link>
        <Link href="/student" className="gc-btn gc-btn-secondary gc-btn-md">
          홈으로
        </Link>
      </div>
    </div>
  );
}
