/**
 * /service/[slug] — 상품 상세 (공개).
 *
 * 카드사 심사에서 확인하는 "상품/서비스의 명칭·상세설명·금액·서비스 제공기간"이
 * 한 화면에 모두 보여야 한다. 신청 버튼은 로그인 후 주문서로 이어진다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PRODUCT_LIST, productBySlug, won } from "@/lib/products";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = productBySlug(slug);
  if (!p) return { title: "서비스 안내 | GLOCARE" };
  return { title: `${p.name} | GLOCARE`, description: p.tagline };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("study_issuance_pricing")
    .select("std_key, unit_price, is_active")
    .eq("std_key", product.key)
    .eq("is_active", true)
    .maybeSingle();

  const price = row?.unit_price ?? null;
  const others = PRODUCT_LIST.filter((p) => p.key !== product.key);

  return (
    <section className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <Link href="/service" className="gc-btn gc-btn-ghost" style={{ paddingLeft: 0 }}>
            ← 서비스 안내
          </Link>
          <div className="sec-eyebrow" style={{ marginTop: 12 }}>
            판매 상품
          </div>
          <h1 className="sec-title">{product.name}</h1>
          <p className="sec-desc">{product.tagline}</p>
        </div>

        <div className="product-detail">
          <div>
            <div className="gc-card">
              <h2 className="gc-page-title">상세 설명</h2>
              <p className="gc-page-desc" style={{ maxWidth: "none" }}>
                {product.description}
              </p>
            </div>

            <div className="gc-card" style={{ marginTop: 16 }}>
              <h2 className="gc-page-title">포함 내역</h2>
              <div className="gc-dotlist">
                {product.includes.map((it) => (
                  <div key={it} className="gc-dotrow">
                    <span className="gc-dot is-hot" />
                    <span>{it}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="gc-card" style={{ marginTop: 16 }}>
              <h2 className="gc-page-title">포함되지 않는 항목</h2>
              <div className="gc-dotlist">
                {product.excludes.map((it) => (
                  <div key={it} className="gc-dotrow">
                    <span className="gc-dot" />
                    <span>{it}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 구매 요약 — 금액·제공기간·환불을 결제 직전에 한 번 더 */}
          <aside className="product-buy">
            <div className="gc-eyebrow-sm">결제 금액</div>
            <div className="product-price" style={{ marginTop: 4 }}>
              {price != null ? (
                <>
                  <span className="product-price-n gc-mono">{won(price)}</span>
                  <span className="product-price-vat">부가세 포함</span>
                </>
              ) : (
                <span className="product-price-vat">금액 준비 중</span>
              )}
            </div>

            <dl className="product-terms">
              <div>
                <dt>서비스 제공기간</dt>
                <dd>{product.duration}</dd>
              </div>
              <div>
                <dt>제공 방식</dt>
                <dd>
                  온라인 접수 후 담당자가 진행합니다. 완료 서류는 스캔본 전달 및
                  원본 발송으로 제공됩니다.
                </dd>
              </div>
              <div>
                <dt>취소·환불</dt>
                <dd>
                  <Link href="/refund">취소·환불 규정</Link>에 따릅니다.
                </dd>
              </div>
              <div>
                <dt>판매자</dt>
                <dd>
                  {COMPANY.name} · {COMPANY.tel}
                </dd>
              </div>
            </dl>

            {price != null ? (
              <Link
                href={`/student/order/${product.slug}`}
                className="gc-btn gc-btn-primary gc-btn-lg gc-btn-block"
                style={{ marginTop: 20 }}
              >
                신청하기
                <span className="arrow" aria-hidden>
                  →
                </span>
              </Link>
            ) : null}
            <p className="gc-hint" style={{ textAlign: "center" }}>
              신청하려면 로그인이 필요합니다.
            </p>
          </aside>
        </div>

        {others.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 className="gc-page-title">다른 서비스</h2>
            <div className="gc-grid gc-grid-2" style={{ marginTop: 12 }}>
              {others.map((p) => (
                <Link
                  key={p.key}
                  href={`/service/${p.slug}`}
                  className="gc-card gc-card-hover"
                >
                  <div className="gc-card-title" style={{ fontSize: 16 }}>
                    {p.name}
                  </div>
                  <p className="gc-page-desc">{p.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
