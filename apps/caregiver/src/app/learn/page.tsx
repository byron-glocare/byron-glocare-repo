import Link from "next/link";
import { PlaySquare, BookOpenCheck } from "lucide-react";

import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const t = await getDict();

  const cards = [
    {
      href: "/videos",
      icon: <PlaySquare />,
      title: t["learn.videos.title"],
      desc: t["learn.videos.desc"],
    },
    {
      href: "/cbt",
      icon: <BookOpenCheck />,
      title: t["learn.cbt.title"],
      desc: t["learn.cbt.desc"],
    },
  ];

  return (
    <div className="page-wrap fade-up" style={{ maxWidth: 760 }}>
      <div className="eyebrow">{t["learn.eyebrow"]}</div>
      <h1 className="page-title">{t["learn.title"]}</h1>
      <p className="page-desc">{t["learn.intro"]}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
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
                background: "var(--coral)",
                color: "var(--white)",
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
    </div>
  );
}
