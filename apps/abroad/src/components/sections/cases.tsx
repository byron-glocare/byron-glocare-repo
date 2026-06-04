import { TikTokThumb } from "@/components/tiktok-thumb";
import type { Dict, Locale } from "@/lib/i18n";

type CaseCard = {
  id: number;
  title: string;
  category: string;
  thumb: string | null;
  url: string | null;
};

export function Cases({
  t,
  cases,
}: {
  t: Dict;
  locale: Locale;
  cases: CaseCard[];
}) {
  return (
    <section id="cases" className="section">
      <div className="sec-inner">
        <div className="hdr-row">
          <div>
            <div className="sec-eyebrow">{t["section.cases.eyebrow"]}</div>
            <h2 className="sec-title">
              {t["section.cases.title.prefix"]}
              <em>{t["section.cases.title.em"]}</em>
              {t["section.cases.title.suffix"]}
            </h2>
            <p className="sec-desc">{t["section.cases.desc"]}</p>
          </div>
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
                <div className="case-vid-play">
                  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="rgba(255,255,255,0.92)"
                    />
                    <path d="M26 22 L46 32 L26 42 Z" fill="var(--coral)" />
                  </svg>
                </div>
              </div>
              <div className="case-body">
                {c.category && (
                  <div className="case-tags">
                    <span className="case-tag">{c.category}</span>
                  </div>
                )}
                <div className="case-ttl">{c.title}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
