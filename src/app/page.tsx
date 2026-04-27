import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  // RLS 가 익명 read 에 active=true 강제
  const [{ data: universities }, { data: cases }, { data: centers }] =
    await Promise.all([
      supabase
        .from("universities")
        .select(
          "id, name_ko, name_vi, region_ko, region_vi, emoji, categories"
        )
        .order("id"),
      supabase
        .from("study_cases")
        .select(
          "id, title_ko, title_vi, category_ko, category_vi, tiktok_thumb, tiktok_url, hero"
        )
        .order("hero", { ascending: false })
        .limit(6),
      supabase
        .from("study_centers")
        .select("id, name_ko, name_vi, city_ko, city_vi, flag")
        .order("id"),
    ]);

  return (
    <>
      <section className="bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t["hero.title"]}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            {t["hero.subtitle"]}
          </p>
          <Link
            href="/apply"
            className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t["nav.apply"]}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-bold">{t["nav.universities"]}</h2>
          <Link
            href="/universities"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            전체 →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(universities ?? []).map((u) => (
            <Link
              key={u.id}
              href={`/universities/${u.id}`}
              className="rounded-lg border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-2">{u.emoji ?? "🎓"}</div>
              <div className="font-bold text-base mb-1">
                {locale === "vi" ? (u.name_vi ?? u.name_ko) : u.name_ko}
              </div>
              <div className="text-xs text-muted-foreground">
                {locale === "vi" ? (u.region_vi ?? u.region_ko) : u.region_ko}
              </div>
              {u.categories && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {u.categories
                    .split(",")
                    .slice(0, 3)
                    .map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                      >
                        {c.trim()}
                      </span>
                    ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-bold">{t["nav.cases"]}</h2>
            <Link
              href="/cases"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              전체 →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(cases ?? []).map((c) => (
              <a
                key={c.id}
                href={c.tiktok_url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg overflow-hidden border border-border/60 bg-card hover:shadow-md transition-all"
              >
                {c.tiktok_thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.tiktok_thumb}
                    alt=""
                    className="w-full aspect-[3/4] object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    {locale === "vi"
                      ? (c.category_vi ?? c.category_ko)
                      : c.category_ko}
                  </div>
                  <div className="font-medium">
                    {locale === "vi"
                      ? (c.title_vi ?? c.title_ko)
                      : c.title_ko}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-bold">{t["nav.centers"]}</h2>
          <Link
            href="/centers"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            전체 →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(centers ?? []).map((c) => (
            <div
              key={c.id}
              className="rounded-md border border-border/60 bg-card p-4 flex items-center gap-3"
            >
              <div className="text-2xl shrink-0">{c.flag ?? "🇻🇳"}</div>
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {locale === "vi" ? c.name_vi : (c.name_ko ?? c.name_vi)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {locale === "vi" ? (c.city_vi ?? c.city_ko) : c.city_ko}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
