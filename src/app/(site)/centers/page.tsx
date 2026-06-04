import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function CentersPage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data: centers } = await supabase
    .from("study_centers")
    .select("*")
    .order("id");

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">{t["nav.centers"]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {(centers ?? []).map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-border/60 bg-card p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{c.flag ?? "🇻🇳"}</span>
              <div className="font-bold">
                {locale === "vi" ? c.name_vi : (c.name_ko ?? c.name_vi)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {c.address && <div>📍 {c.address}</div>}
              {c.phone && <div>📞 {c.phone}</div>}
              {c.email && <div>✉ {c.email}</div>}
              {c.years_ko && (
                <div>
                  📅{" "}
                  {locale === "vi" ? (c.years_vi ?? c.years_ko) : c.years_ko}
                </div>
              )}
              {c.students_ko && (
                <div>
                  👥{" "}
                  {locale === "vi"
                    ? (c.students_vi ?? c.students_ko)
                    : c.students_ko}
                </div>
              )}
            </div>
            {c.desc_ko && (
              <p className="mt-3 text-sm">
                {locale === "vi" ? (c.desc_vi ?? c.desc_ko) : c.desc_ko}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
