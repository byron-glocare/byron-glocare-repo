import { TikTokThumb } from "@/components/tiktok-thumb";
import type { Dict, Locale } from "@/lib/i18n";

type CaseCard = {
  id: number;
  title: string;
  category: string;
  thumb: string | null;
  url: string | null;
};

/** 사례 카드 — 썸네일(9:12) + 카테고리 12px primary + 제목 16px. 배지 대신 텍스트 위계. */
export function Cases({
  t,
  cases,
}: {
  t: Dict;
  locale: Locale;
  cases: CaseCard[];
}) {
  if (cases.length === 0) return null;

  return (
    <section id="cases" className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">{t["section.cases.eyebrow"]}</div>
          <h2 className="sec-title">
            {t["section.cases.title.prefix"]}
            <em>{t["section.cases.title.em"]}</em>
            {t["section.cases.title.suffix"]}
          </h2>
          <p className="sec-desc">{t["section.cases.desc"]}</p>
        </div>

        <div className="cases-grid">
          {cases.map((c) => (
            <a
              key={c.id}
              href={c.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="case-card"
              aria-label={c.title}
            >
              <div className="case-vid">
                <TikTokThumb src={c.thumb} videoUrl={c.url} alt={c.title} />
                <div className="vid-play">
                  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="28" fill="rgba(255,255,255,0.92)" />
                    <path d="M26 22 L46 32 L26 42 Z" fill="var(--gc-primary-600)" />
                  </svg>
                </div>
              </div>
              <div className="case-body">
                {c.category && <div className="case-cat">{c.category}</div>}
                <div className="case-ttl">{c.title}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
