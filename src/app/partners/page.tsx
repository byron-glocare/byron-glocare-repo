import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Tab = "training_centers" | "care_homes" | "universities";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab =
    sp.tab === "care_homes" || sp.tab === "universities"
      ? sp.tab
      : "training_centers";

  const t = await getDict();
  const locale = await getLocale();
  const supabase = await createClient();

  const [centers, homes, unis] = await Promise.all([
    supabase
      .from("training_centers")
      .select(
        "id, name, region, tuition_fee_2026, class_hours, naeil_card_eligible"
      )
      .eq("contract_active", true)
      .order("name"),
    supabase
      .from("care_homes")
      .select("id, name, region, bed_capacity")
      .order("name"),
    supabase
      .from("universities")
      .select(
        "id, name_ko, name_vi, region_ko, region_vi, emoji, tags_ko, tags_vi, categories"
      )
      .eq("active", true)
      .order("id"),
  ]);

  return (
    <div className="page-wrap">
      <div className="eyebrow">{t["partners.eyebrow"]}</div>
      <h1 className="page-title">
        <em>{t["partners.title"]}</em>
      </h1>
      <p className="page-desc">{t["partners.intro"]}</p>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        <TabLink
          href="/partners?tab=training_centers"
          active={tab === "training_centers"}
        >
          {t["partners.tab.training_centers"]} ({centers.data?.length ?? 0})
        </TabLink>
        <TabLink href="/partners?tab=care_homes" active={tab === "care_homes"}>
          {t["partners.tab.care_homes"]} ({homes.data?.length ?? 0})
        </TabLink>
        <TabLink
          href="/partners?tab=universities"
          active={tab === "universities"}
        >
          {t["partners.tab.universities"]} ({unis.data?.length ?? 0})
        </TabLink>
      </div>

      {tab === "training_centers" && (
        <Grid>
          {(centers.data ?? []).map((c) => (
            <div key={c.id} className="card">
              <div
                style={{
                  fontFamily: "var(--font-noto-serif-kr), serif",
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  marginBottom: "0.4rem",
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--ink-light)",
                  marginBottom: "0.6rem",
                }}
              >
                📍 {c.region ?? "—"}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-mid)" }}>
                <div>
                  💰 {c.tuition_fee_2026?.toLocaleString() ?? "—"} 원 (2026)
                </div>
                <div>🕒 {c.class_hours ?? "—"}</div>
                {c.naeil_card_eligible && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      display: "inline-block",
                      background: "var(--coral-pale)",
                      color: "var(--coral-d)",
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                    }}
                  >
                    내일배움카드 가능
                  </div>
                )}
              </div>
            </div>
          ))}
          {(centers.data ?? []).length === 0 && (
            <Empty text={t["partners.empty"]} />
          )}
        </Grid>
      )}

      {tab === "care_homes" && (
        <Grid>
          {(homes.data ?? []).map((c) => (
            <div key={c.id} className="card">
              <div
                style={{
                  fontFamily: "var(--font-noto-serif-kr), serif",
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "var(--ink)",
                  marginBottom: "0.4rem",
                }}
              >
                🏥 {c.name}
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--ink-light)",
                  marginBottom: "0.6rem",
                }}
              >
                📍 {c.region ?? "—"}
              </div>
              {c.bed_capacity && (
                <div style={{ fontSize: "0.82rem", color: "var(--ink-mid)" }}>
                  🛏 베드 {c.bed_capacity}
                </div>
              )}
            </div>
          ))}
          {(homes.data ?? []).length === 0 && (
            <Empty text={t["partners.empty"]} />
          )}
        </Grid>
      )}

      {tab === "universities" && (
        <Grid>
          {(unis.data ?? []).map((u) => {
            const name = locale === "vi" ? (u.name_vi ?? u.name_ko) : u.name_ko;
            const region =
              locale === "vi" ? (u.region_vi ?? u.region_ko) : u.region_ko;
            const tagsRaw = locale === "vi" ? u.tags_vi : u.tags_ko;
            const tags = (tagsRaw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
            return (
              <div key={u.id} className="card">
                <div
                  style={{
                    fontFamily: "var(--font-noto-serif-kr), serif",
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: "var(--ink)",
                    marginBottom: "0.4rem",
                  }}
                >
                  {u.emoji ?? "🎓"} {name}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--ink-light)",
                    marginBottom: "0.6rem",
                  }}
                >
                  📍 {region ?? "—"}
                </div>
                {u.categories && (
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--ink-mid)",
                      marginBottom: "0.6rem",
                    }}
                  >
                    {u.categories}
                  </div>
                )}
                {tags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.3rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 12,
                          background: "var(--peach)",
                          color: "var(--coral-d)",
                          border: "1px solid var(--coral-soft)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {(unis.data ?? []).length === 0 && (
            <Empty text={t["partners.empty"]} />
          )}
        </Grid>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        padding: "8px 18px",
        borderRadius: 30,
        fontSize: "0.85rem",
        fontWeight: 700,
        border: `1.5px solid ${active ? "var(--coral)" : "var(--border-d)"}`,
        background: active ? "var(--coral)" : "var(--white)",
        color: active ? "var(--white)" : "var(--ink-light)",
        transition: "all 0.2s",
      }}
    >
      {children}
    </a>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "1.2rem",
      }}
    >
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        padding: "3rem",
        textAlign: "center",
        color: "var(--ink-light)",
        fontSize: "0.9rem",
      }}
    >
      {text}
    </div>
  );
}
