import Link from "next/link";

import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ServicePage() {
  const t = await getDict();

  const steps = [
    { title: t["service.step1.title"], desc: t["service.step1.desc"] },
    { title: t["service.step2.title"], desc: t["service.step2.desc"] },
    { title: t["service.step3.title"], desc: t["service.step3.desc"] },
    { title: t["service.step4.title"], desc: t["service.step4.desc"] },
    { title: t["service.step5.title"], desc: t["service.step5.desc"] },
    { title: t["service.step6.title"], desc: t["service.step6.desc"] },
  ];

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["service.eyebrow"]}</div>
      <h1 className="page-title">{t["service.title"]}</h1>
      <p className="page-desc">{t["service.intro"]}</p>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: "2rem 0 0",
          display: "grid",
          gap: "0.9rem",
        }}
      >
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="card"
            style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "var(--coral)",
                color: "var(--white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.95rem",
              }}
            >
              {i + 1}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-noto-serif-kr), serif",
                  fontWeight: 800,
                  color: "var(--ink)",
                  marginBottom: "0.25rem",
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: "0.88rem",
                  color: "var(--ink-light)",
                  lineHeight: 1.65,
                }}
              >
                {s.desc}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div
        className="card"
        style={{
          marginTop: "1.5rem",
          background: "var(--peach)",
          border: "none",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-noto-serif-kr), serif",
            fontWeight: 800,
            color: "var(--ink)",
            marginBottom: "0.4rem",
          }}
        >
          {t["service.employment.title"]}
        </div>
        <div
          style={{
            fontSize: "0.88rem",
            color: "var(--ink-mid)",
            lineHeight: 1.7,
          }}
        >
          {t["service.employment.desc"]}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
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
          {t["service.cta"]}
        </Link>
      </div>
    </div>
  );
}
