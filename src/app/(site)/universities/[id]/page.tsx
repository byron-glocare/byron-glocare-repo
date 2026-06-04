import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const t = await getDict();

  const { data: u } = await supabase
    .from("universities")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (!u) notFound();

  const { data: depts } = await supabase
    .from("departments")
    .select("*")
    .eq("university_id", u.id)
    .order("sort_order")
    .order("id");

  const name = locale === "vi" ? (u.name_vi ?? u.name_ko) : u.name_ko;
  const region = locale === "vi" ? (u.region_vi ?? u.region_ko) : u.region_ko;
  const desc = locale === "vi" ? (u.desc_vi ?? u.desc_ko) : u.desc_ko;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 text-center">
        <div className="text-5xl mb-3">{u.emoji ?? "🎓"}</div>
        <h1 className="text-3xl font-bold mb-1">{name}</h1>
        <p className="text-muted-foreground">{region}</p>
        {u.website_url && (
          <a
            href={u.website_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 text-sm text-primary hover:underline"
          >
            {u.website_url} ↗
          </a>
        )}
      </header>

      {desc && (
        <section className="prose prose-sm max-w-none mb-10 whitespace-pre-line text-foreground">
          {desc}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        <Card title="📚 강점 / Strengths">
          {u.strengths || "—"}
        </Card>
        <Card title="🚉 교통 / Giao thông">
          {locale === "vi"
            ? (u.transport_desc_vi ?? u.transport_desc_ko)
            : u.transport_desc_ko}
        </Card>
        <Card title="🏠 기숙사 / Ký túc xá">
          {u.dormitory ? (
            locale === "vi"
              ? (u.dormitory_desc_vi ?? u.dormitory_desc_ko)
              : u.dormitory_desc_ko
          ) : (
            "—"
          )}
        </Card>
        <Card title="📅 수업일 / Ngày học">
          {locale === "vi"
            ? (u.class_days_vi ?? u.class_days_ko)
            : u.class_days_ko}
        </Card>
      </div>

      {depts && depts.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">학과 / Ngành học</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {depts.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border/60 bg-card p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{d.icon ?? "📘"}</span>
                  <div className="font-medium">
                    {locale === "vi" ? (d.name_vi ?? d.name_ko) : d.name_ko}
                  </div>
                  {d.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                      {d.badge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {d.degree_years && <div>학년: {d.degree_years}</div>}
                  {d.tuition_ko && (
                    <div>
                      💰{" "}
                      {locale === "vi"
                        ? (d.tuition_vi ?? d.tuition_ko)
                        : d.tuition_ko}
                    </div>
                  )}
                  {d.scholarship_ko && (
                    <div>
                      🎓{" "}
                      {locale === "vi"
                        ? (d.scholarship_vi ?? d.scholarship_ko)
                        : d.scholarship_ko}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="text-center mt-12">
        <a
          href="/apply"
          className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t["nav.apply"]}
        </a>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">
        {title}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
