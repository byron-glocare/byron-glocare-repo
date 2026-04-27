import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data: cases } = await supabase
    .from("study_cases")
    .select("*")
    .order("hero", { ascending: false })
    .order("id", { ascending: false });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">{t["nav.cases"]}</h1>
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
              <div className="font-medium mb-2">
                {locale === "vi" ? (c.title_vi ?? c.title_ko) : c.title_ko}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {locale === "vi" ? (c.desc_vi ?? c.desc_ko) : c.desc_ko}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
