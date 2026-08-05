import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** 센터 이름 이니셜 2자 — 국기 이모지 대체. */
function initials(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default async function CentersPage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data: centers } = await supabase
    .from("study_centers")
    .select("*")
    .order("id");

  return (
    <section className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">{t["section.centers.eyebrow"]}</div>
          <h2 className="sec-title">{t["nav.centers"]}</h2>
          <p className="sec-desc">{t["section.centers.desc"]}</p>
        </div>

        <div className="center-grid">
          {(centers ?? []).map((c) => {
            const name =
              (locale === "vi" ? c.name_vi : (c.name_ko ?? c.name_vi)) ?? "";
            const desc =
              locale === "vi" ? (c.desc_vi ?? c.desc_ko) : c.desc_ko;
            const years =
              locale === "vi" ? (c.years_vi ?? c.years_ko) : c.years_ko;
            const students =
              locale === "vi" ? (c.students_vi ?? c.students_ko) : c.students_ko;

            return (
              <div key={c.id} className="center-card">
                <div className="center-head">
                  <div className="center-mark" aria-hidden>
                    {initials(name)}
                  </div>
                  <div>
                    <div className="center-name">{name}</div>
                    {c.address && <div className="center-city">{c.address}</div>}
                  </div>
                </div>

                <div className="center-desc">
                  {desc || t["section.centers.updating"]}
                </div>

                <div className="gc-dotlist" style={{ gap: 6 }}>
                  {c.phone && (
                    <div className="cmeta">
                      <span className="gc-k">{t["footer.k.phone"]}</span>
                      <span className="gc-mono">{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="cmeta">
                      <span className="gc-k">Email</span>
                      {c.email}
                    </div>
                  )}
                </div>

                {(students || years) && (
                  <div className="center-meta">
                    {students && <span className="cmeta">{students}</span>}
                    {years && <span className="cmeta">{years}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
