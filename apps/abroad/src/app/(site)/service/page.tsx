/**
 * /service — 판매 상품 목록 (공개).
 *
 * 카드사 심사에서 "결제 가능한 실제 판매 상품"을 확인하는 URL이다.
 * 로그인 없이 상품명·금액·상세설명·서비스 제공기간이 보여야 하므로 공개 라우트에 둔다.
 * 금액은 DB(study_issuance_pricing)에서 읽어 어드민 수정이 즉시 반영되게 한다.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { PRODUCT_LIST, won, type ProductKey } from "@/lib/products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "서비스 안내 | GLOCARE",
  description:
    "한국 유학 서류 발급 대행과 유학 준비 종합 컨설팅 서비스의 구성과 금액을 안내합니다.",
};

export default async function ServicePage() {
  const supabase = await createClient();
  const { data: pricing } = await supabase
    .from("study_issuance_pricing")
    .select("std_key, unit_price, is_active")
    .eq("is_active", true);

  const priceOf = (key: ProductKey): number | null =>
    (pricing ?? []).find((p) => p.std_key === key)?.unit_price ?? null;

  return (
    <section className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">서비스 안내</div>
          <h1 className="sec-title">
            유학 준비, <em>필요한 만큼만</em>
          </h1>
          <p className="sec-desc">
            서류 발급만 맡기거나, 지원 준비 전 과정을 함께할 수 있습니다. 모든
            금액은 부가세가 포함된 가격입니다.
          </p>
        </div>

        <div className="gc-grid gc-grid-2">
          {PRODUCT_LIST.map((p) => {
            const price = priceOf(p.key);
            return (
              <div key={p.key} className="gc-card gc-card-hover">
                <div className="gc-eyebrow-sm">{p.tagline}</div>
                <h2 className="gc-card-title" style={{ marginTop: 6 }}>
                  {p.name}
                </h2>

                <div className="product-price">
                  {price != null ? (
                    <>
                      <span className="product-price-n gc-mono">
                        {won(price)}
                      </span>
                      <span className="product-price-vat">부가세 포함</span>
                    </>
                  ) : (
                    <span className="product-price-vat">금액 준비 중</span>
                  )}
                </div>

                <div className="gc-dotlist">
                  {p.includes.slice(0, 6).map((it) => (
                    <div key={it} className="gc-dotrow">
                      <span className="gc-dot is-hot" />
                      <span>{it}</span>
                    </div>
                  ))}
                </div>

                <div className="product-meta">
                  <span className="gc-k">서비스 제공기간</span>
                  {p.duration}
                </div>

                <Link
                  href={`/service/${p.slug}`}
                  className="gc-btn gc-btn-primary gc-btn-md"
                  style={{ marginTop: 16 }}
                >
                  자세히 보고 신청
                  <span className="arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            );
          })}
        </div>

        <p className="gc-hint" style={{ marginTop: 24 }}>
          결제 취소 및 환불은 <Link href="/refund">취소·환불 규정</Link>에
          따릅니다.
        </p>
      </div>
    </section>
  );
}
