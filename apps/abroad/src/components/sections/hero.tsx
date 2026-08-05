import Link from "next/link";

import { TikTokThumb } from "@/components/tiktok-thumb";
import type { Dict } from "@/lib/i18n";

type HeroVideo = {
  id: number;
  title: string;
  category: string;
  thumb: string | null;
  url: string | null;
};

/**
 * 히어로 — 디자인 시스템 골격.
 *   배경 canvas 단색(그라디언트·데코 금지) / display 52·34px
 *   강조는 문장 안 한 구절만 primary-600 / 버튼은 primary lg + secondary lg
 *   좌측 하단 통계는 mono 26px, 우측은 사례 카드 2개(9:13)
 */
export function Hero({
  t,
  videos,
  stats,
}: {
  t: Dict;
  videos: HeroVideo[];
  stats: { universities: number; centers: number };
}) {
  return (
    <section id="hero">
      <div className="hero-inner">
        <div className="fu">
          <div className="hero-badge">{t["hero.badge"]}</div>

          <h1 className="hero-title">
            <em>{t["hero.title.em"]}</em> {t["hero.title.line2"]}
          </h1>
          <p className="hero-lead">{t["hero.subtitle"]}</p>

          <div className="hero-btns">
            <Link href="/student" className="btn-coral">
              {t["hero.cta.student"]}
              <span className="arrow" aria-hidden>
                →
              </span>
            </Link>
            <Link href="/#apply" className="btn-ghost">
              {t["hero.cta.primary"]}
            </Link>
          </div>

          <div className="hero-stats">
            <div>
              <div className="hero-stat-n">{stats.universities}</div>
              <div className="hero-stat-l">{t["hero.stat.universities"]}</div>
            </div>
            <div>
              <div className="hero-stat-n">{stats.centers}</div>
              <div className="hero-stat-l">{t["hero.stat.centers"]}</div>
            </div>
            <div>
              <div className="hero-stat-n">100%</div>
              <div className="hero-stat-l">{t["hero.stat.support"]}</div>
            </div>
          </div>
        </div>

        {videos.length > 0 && (
          <div className="hero-videos fu d2">
            {videos.slice(0, 2).map((v) => (
              <a
                key={v.id}
                href={v.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="hero-vid-card"
                aria-label={v.title}
              >
                <div className="hero-vid-thumb">
                  <TikTokThumb src={v.thumb} videoUrl={v.url} alt={v.title} />
                  <div className="vid-play">
                    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="32" cy="32" r="28" fill="rgba(255,255,255,0.92)" />
                      <path d="M26 22 L46 32 L26 42 Z" fill="var(--gc-primary-600)" />
                    </svg>
                  </div>
                </div>
                <div className="hero-vid-body">
                  {v.category && <div className="hero-vid-cat">{v.category}</div>}
                  <div className="hero-vid-ttl">{v.title}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
