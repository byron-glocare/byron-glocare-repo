import type { Dict } from "@/lib/i18n";

type Center = {
  id: number;
  flag: string;
  name: string;
  city: string;
  desc: string;
  students: string;
  years: string;
};

export function Centers({ t, centers }: { t: Dict; centers: Center[] }) {
  return (
    <section id="centers" className="section">
      <div className="sec-inner">
        <div className="hdr-row">
          <div>
            <div className="sec-eyebrow">{t["section.centers.eyebrow"]}</div>
            <h2 className="sec-title">
              {t["section.centers.title.prefix"]}
              <em>{t["section.centers.title.em"]}</em>
              {t["section.centers.title.suffix"]}
            </h2>
            <p className="sec-desc">{t["section.centers.desc"]}</p>
          </div>
        </div>
        <div className="center-grid">
          {centers.map((c) => (
            <div key={c.id} className="center-card">
              <div className="center-flag">{c.flag}</div>
              <div className="center-name">{c.name}</div>
              <div className="center-city">{c.city}</div>
              {c.desc && <div className="center-desc">{c.desc}</div>}
              <div className="center-meta">
                {c.students && <span className="cmeta">👥 {c.students}</span>}
                {c.years && <span className="cmeta">📅 {c.years}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
