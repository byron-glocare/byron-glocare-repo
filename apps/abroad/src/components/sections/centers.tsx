import type { Dict } from "@/lib/i18n";

type Center = {
  id: number;
  name: string;
  city: string;
  desc: string;
  students: string;
  years: string;
};

/** 센터 이름 이니셜 2자 — 국기 이모지 대체. 전 카드가 같은 국기라 구분 정보가 아니다. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function Centers({ t, centers }: { t: Dict; centers: Center[] }) {
  if (centers.length === 0) return null;

  return (
    <section id="centers" className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">{t["section.centers.eyebrow"]}</div>
          <h2 className="sec-title">
            {t["section.centers.title.prefix"]}
            <em>{t["section.centers.title.em"]}</em>
            {t["section.centers.title.suffix"]}
          </h2>
          <p className="sec-desc">{t["section.centers.desc"]}</p>
        </div>

        <div className="center-grid">
          {centers.map((c) => (
            <div key={c.id} className="center-card">
              <div className="center-head">
                <div className="center-mark" aria-hidden>
                  {initials(c.name)}
                </div>
                <div>
                  <div className="center-name">{c.name}</div>
                  {c.city && <div className="center-city">{c.city}</div>}
                </div>
              </div>

              <div className="center-desc">
                {c.desc || t["section.centers.updating"]}
              </div>

              {(c.students || c.years) && (
                <div className="center-meta">
                  {c.students && <span className="cmeta">{c.students}</span>}
                  {c.years && <span className="cmeta">{c.years}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
