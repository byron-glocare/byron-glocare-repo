import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function UniversitiesPage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data: universities } = await supabase
    .from("universities")
    .select("*")
    .order("id");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">{t["nav.universities"]}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(universities ?? []).map((u) => (
          <Link
            key={u.id}
            href={`/universities/${u.id}`}
            className="rounded-lg border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="text-3xl mb-2">{u.emoji ?? "🎓"}</div>
            <div className="font-bold mb-1">
              {locale === "vi" ? (u.name_vi ?? u.name_ko) : u.name_ko}
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {locale === "vi" ? (u.region_vi ?? u.region_ko) : u.region_ko}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {locale === "vi" ? (u.desc_vi ?? u.desc_ko) : u.desc_ko}
            </p>
            {u.tags_ko && (
              <div className="mt-3 flex flex-wrap gap-1">
                {(locale === "vi" ? u.tags_vi : u.tags_ko)
                  ?.split(",")
                  .slice(0, 3)
                  .map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {tag.trim()}
                    </span>
                  ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
