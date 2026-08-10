/**
 * /student/order/[slug] — 주문서 + 결제.
 *
 * 카드사 심사에서 확인하는 "구매 과정" 화면이다. 한 화면에
 * 상품명·금액·서비스 제공기간·주문자 정보·결제수단 선택·약관 동의가 모두 보여야 한다.
 */

import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyStudentSession } from "@/lib/student/dal";
import { productBySlug, won } from "@/lib/products";
import { COMPANY } from "@/lib/company";
import { isTossConfigured, tossClientKey } from "@/lib/payments/toss";

import { ensureProductOrder } from "../actions";
import { Checkout } from "./checkout";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();

  const session = await verifyStudentSession();
  const order = await ensureProductOrder(slug);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/service/${product.slug}`} className="text-sm text-ink-light hover:underline">
          ← 상품 상세
        </Link>
        <h1 className="mt-2 gc-page-title">주문 · 결제</h1>
        <p className="gc-page-desc">
          아래 내용을 확인하고 결제를 진행해 주세요.
        </p>
      </div>

      <div className="order-grid">
        {/* 주문 내역 */}
        <div className="gc-card">
          <div className="gc-eyebrow-sm">주문 상품</div>
          <div className="gc-card-title" style={{ marginTop: 6 }}>
            {product.name}
          </div>
          <p className="gc-page-desc">{product.tagline}</p>

          <div className="gc-dotlist">
            {product.includes.map((it) => (
              <div key={it} className="gc-dotrow">
                <span className="gc-dot is-hot" />
                <span>{it}</span>
              </div>
            ))}
          </div>

          <dl className="product-terms">
            <div>
              <dt>서비스 제공기간</dt>
              <dd>{product.duration}</dd>
            </div>
            <div>
              <dt>주문자</dt>
              <dd>
                {session.student.name ?? "-"} ·{" "}
                {session.student.email ?? session.email ?? "-"}
              </dd>
            </div>
            <div>
              <dt>판매자</dt>
              <dd>
                {COMPANY.name} · {COMPANY.tel}
              </dd>
            </div>
            <div>
              <dt>취소·환불</dt>
              <dd>
                <Link href="/refund">취소·환불 규정</Link>에 따릅니다.
              </dd>
            </div>
          </dl>
        </div>

        {/* 결제 */}
        <aside className="gc-card">
          <div className="gc-eyebrow-sm">결제 금액</div>
          {order.ok ? (
            <>
              <div className="product-price" style={{ marginTop: 4 }}>
                <span className="product-price-n gc-mono">
                  {won(order.amount)}
                </span>
                <span className="product-price-vat">부가세 포함</span>
              </div>

              {isTossConfigured() ? (
                <Checkout
                  clientKey={tossClientKey()}
                  customerKey={session.student.id}
                  tossOrderId={order.tossOrderId}
                  orderName={order.orderName}
                  amount={order.amount}
                  customerName={session.student.name ?? "고객"}
                  customerEmail={session.student.email ?? session.email ?? ""}
                  origin={origin}
                />
              ) : (
                <div className="gc-note gc-note-warn" style={{ marginTop: 16 }}>
                  결제 모듈이 아직 설정되지 않았습니다. 환경변수{" "}
                  <code>NEXT_PUBLIC_TOSS_CLIENT_KEY</code>,{" "}
                  <code>TOSS_SECRET_KEY</code> 를 설정해 주세요.
                </div>
              )}
            </>
          ) : (
            <div className="gc-note" style={{ background: "var(--gc-error-bg)", color: "var(--gc-error)" }}>
              {order.error}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
