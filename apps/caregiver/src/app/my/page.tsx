import Link from "next/link";
import { GraduationCap, FileText, User } from "lucide-react";

import { getAuthState } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const t = await getDict();
  const auth = await getAuthState();
  if (auth.kind === "guest") {
    const { redirect } = await import("next/navigation");
    redirect("/login?next=/my");
  }

  const pt = auth.kind === "mapped" ? auth.customer.product_type : null;
  const depositKind =
    pt === "웰컴팩" || pt === "교육+웰컴팩"
      ? "welcomepack_reservation"
      : "education_reservation";

  const cards = [
    {
      href: "/learn",
      icon: <GraduationCap />,
      title: t["my.learn.title"],
      desc: t["my.learn.desc"],
    },
    {
      href: "/resume",
      icon: <FileText />,
      title: t["my.resume.title"],
      desc: t["my.resume.desc"],
    },
    {
      href: "/profile",
      icon: <User />,
      title: t["my.profile.title"],
      desc: t["my.profile.desc"],
    },
  ];

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["my.eyebrow"]}</div>
      <h1 className="page-title">{t["my.title"]}</h1>
      <p className="page-desc">{t["my.intro"]}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.2rem",
          marginTop: "2rem",
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card"
            style={{ display: "block", color: "inherit" }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "var(--coral-pale)",
                color: "var(--coral)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "0.9rem",
              }}
            >
              {c.icon}
            </div>
            <div
              style={{
                fontFamily: "var(--font-noto-serif-kr), serif",
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "var(--ink)",
                marginBottom: "0.3rem",
              }}
            >
              {c.title}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-light)",
                lineHeight: 1.6,
              }}
            >
              {c.desc}
            </div>
          </Link>
        ))}
      </div>

      {/* 예약금 결제 (P4) */}
      <div
        className="card"
        style={{
          marginTop: "1.2rem",
          background: "var(--peach)",
          border: "none",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-noto-serif-kr), serif",
            fontWeight: 800,
            color: "var(--ink)",
            marginBottom: "0.35rem",
          }}
        >
          {t["my.pay.title"]}
        </div>
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--ink-mid)",
            lineHeight: 1.7,
            marginBottom: "0.9rem",
          }}
        >
          {t["my.pay.desc"]}
        </div>
        <Link
          href={`/pay?kind=${depositKind}`}
          style={{
            display: "inline-block",
            background: "var(--coral)",
            color: "var(--white)",
            fontWeight: 700,
            padding: "0.7rem 1.6rem",
            borderRadius: 10,
          }}
        >
          {t["my.pay.cta"]}
        </Link>
      </div>
    </div>
  );
}
