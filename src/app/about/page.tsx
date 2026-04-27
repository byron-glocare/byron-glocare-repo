import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const supabase = await createClient();
  const t = await getDict();
  const locale = await getLocale();

  const { data: channels } = await supabase
    .from("study_channels")
    .select("*")
    .order("sort_order")
    .order("id");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">{t["nav.about"]}</h1>
      <p className="text-muted-foreground mb-10">
        {locale === "vi"
          ? "Glocare là cầu nối du học giữa Việt Nam và Hàn Quốc."
          : "글로케어는 베트남–한국 유학을 잇는 다리입니다."}
      </p>

      {channels && channels.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">SNS / Kênh truyền thông</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map((ch) => (
              <a
                key={ch.id}
                href={ch.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-md border border-border/60 bg-card p-3 hover:border-primary/40 transition-colors"
              >
                <div className="text-2xl shrink-0">{ch.icon ?? "🔗"}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {locale === "vi"
                      ? (ch.name_vi ?? ch.name_ko)
                      : ch.name_ko}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {ch.handle ?? ch.url}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
