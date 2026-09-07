import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";
import { universityFeatures } from "@/lib/university-features";

export const dynamic = "force-dynamic";

/** 대학 이름 이니셜 2자 — 로고가 없을 때. 이모지는 쓰지 않는다. */
function initials(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default async function UniversitiesPage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data: universities } = await supabase
    .from("universities")
    .select("*")
    .eq("active", true)
    .order("id");

  return (
    <section className="section">
      <div className="sec-inner">
        <div className="sec-head">
          <div className="sec-eyebrow">{t["section.universities.eyebrow"]}</div>
          <h2 className="sec-title">{t["nav.universities"]}</h2>
          <p className="sec-desc">{t["section.universities.desc"]}</p>
        </div>

        <div className="uni-grid">
          {(universities ?? []).map((u) => {
            const name =
              (locale === "vi" ? (u.name_vi ?? u.name_ko) : u.name_ko) ?? "";
            const region =
              locale === "vi" ? (u.region_vi ?? u.region_ko) : u.region_ko;
            const desc = locale === "vi" ? (u.desc_vi ?? u.desc_ko) : u.desc_ko;
            const tags = (locale === "vi" ? u.tags_vi : u.tags_ko)
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 3);
            // 어드민 '홈페이지 노출 정보'의 특징/강점 체크 — 지금까지 어디에도 안 나왔다
            const features = universityFeatures(u, locale);

            return (
              <Link key={u.id} href={`/universities/${u.id}`} className="uni-card">
                <div className="uni-head">
                  <div className="gc-logo">
                    {u.logo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={u.logo_url} alt="" />
                    ) : (
                      initials(name)
                    )}
                  </div>
                </div>

                <div>
                  {region && <div className="uni-region">{region}</div>}
                  <div className="uni-name">{name}</div>
                </div>

                {desc && <p className="center-desc">{desc}</p>}

                {(features.length > 0 || (tags && tags.length > 0)) && (
                  <div className="chip-row">
                    {features.map((f) => (
                      <span key={f} className="chip">
                        {f}
                      </span>
                    ))}
                    {tags?.map((tag, i) => (
                      <span key={`t${i}`} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
