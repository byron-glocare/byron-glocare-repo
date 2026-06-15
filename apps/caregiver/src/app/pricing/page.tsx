import Link from "next/link";

import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const t = await getDict();

  const plans = [
    {
      name: t["pricing.edu.name"],
      deposit: t["pricing.edu.deposit"],
      note: t["pricing.edu.note"],
      feats: [t["pricing.edu.feat1"], t["pricing.edu.feat2"], t["pricing.edu.feat3"]],
      highlight: false,
    },
    {
      name: t["pricing.job.name"],
      deposit: t["pricing.job.deposit"],
      note: t["pricing.job.note"],
      feats: [t["pricing.job.feat1"], t["pricing.job.feat2"], t["pricing.job.feat3"]],
      highlight: true,
    },
  ];

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 820 }}>
      <div className="eyebrow">{t["pricing.eyebrow"]}</div>
      <h1 className="page-title">{t["pricing.title"]}</h1>
      <p className="page-desc">{t["pricing.intro"]}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.2rem",
          marginTop: "2rem",
        }}
      >
        {plans.map((p) => (
          <div
            key={p.name}
            className="card"
            style={{
              border: p.highlight
                ? "2px solid var(--coral)"
                : "1px solid var(--coral-soft)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-noto-serif-kr), serif",
                fontWeight: 800,
                fontSize: "1.1rem",
                color: "var(--ink)",
                marginBottom: "0.5rem",
              }}
            >
              {p.name}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                color: "var(--coral)",
                marginBottom: "0.4rem",
              }}
            >
              {p.deposit}
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-light)",
                lineHeight: 1.6,
                marginBottom: "1rem",
              }}
            >
              {p.note}
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: "0.5rem",
              }}
            >
              {p.feats.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: "0.88rem",
                    color: "var(--ink-mid)",
                    paddingLeft: "1.2rem",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      color: "var(--coral)",
                      fontWeight: 800,
                    }}
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: "0.85rem",
          color: "var(--ink-light)",
          marginTop: "1.5rem",
        }}
      >
        {t["pricing.method"]}
      </p>

      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            background: "var(--coral)",
            color: "var(--white)",
            fontWeight: 700,
            padding: "0.85rem 2rem",
            borderRadius: 12,
          }}
        >
          {t["pricing.cta"]}
        </Link>
      </div>
    </div>
  );
}
