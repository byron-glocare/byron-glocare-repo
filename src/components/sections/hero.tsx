import Link from "next/link";

import { TikTokThumb } from "@/components/tiktok-thumb";
import type { Dict } from "@/lib/i18n";

type HeroVideo = {
  id: number;
  title: string;
  thumb: string | null;
  url: string | null;
};

export function Hero({
  t,
  videos,
}: {
  t: Dict;
  videos: HeroVideo[];
}) {
  return (
    <section id="hero">
      <div className="hero-deco" aria-hidden>
        <svg
          viewBox="0 0 1440 820"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="1200" cy="100" r="380" fill="rgba(242,92,92,0.04)" />
          <circle cx="1200" cy="100" r="260" fill="rgba(242,92,92,0.05)" />
          <circle cx="1200" cy="100" r="140" fill="rgba(242,92,92,0.06)" />
          <circle cx="120" cy="700" r="200" fill="rgba(242,92,92,0.03)" />
          <path
            d="M0 600 Q400 500 800 580 T1440 520 L1440 820 L0 820Z"
            fill="rgba(255,240,240,0.4)"
          />
        </svg>
      </div>

      <div className="hero-inner">
        <div className="fu">
          <div className="hero-flag-badge">
            <span className="flags">🇻🇳 → 🇰🇷</span>
            <span>{t["hero.badge"]}</span>
          </div>
          <h1 className="hero-title">
            <em>{t["hero.title.em"]}</em>
            <br />
            <span>{t["hero.title.line2"]}</span>
            <span className="sub-line">{t["hero.subtitle"]}</span>
          </h1>
          <div className="hero-btns">
            <Link href="/#apply" className="btn-coral">
              {t["hero.cta.primary"]}
            </Link>
            <Link href="/about" className="btn-ghost">
              {t["hero.cta.about"]}
            </Link>
          </div>
        </div>

        <div className="hero-videos fu d2">
          {videos.slice(0, 3).map((v) => (
            <a
              key={v.id}
              href={v.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="hero-vid-card"
              aria-label={v.title}
            >
              <TikTokThumb src={v.thumb} alt={v.title} />
              <div className="vid-play">
                <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="32" cy="32" r="28" fill="rgba(255,255,255,0.92)" />
                  <path d="M26 22 L46 32 L26 42 Z" fill="var(--coral)" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
