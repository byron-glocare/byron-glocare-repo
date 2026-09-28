import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";

import { requireCeo } from "@/lib/ceo/guard";

export const dynamic = "force-dynamic";

export default async function CeoCentersSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const { admin } = await requireCeo();

  let sel = admin
    .from("training_centers")
    .select("id, name, region, phone, director_phone")
    .eq("partnership_terminated", false);

  const safe = query.replace(/[,()]/g, " ").trim();
  if (safe) sel = sel.or(`name.ilike.%${safe}%,region.ilike.%${safe}%`);

  const { data: rows } = await sel.order("name").limit(80);

  return (
    <div className="space-y-4">
      <Link
        href="/ceo"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        뒤로
      </Link>
      <h1 className="text-lg font-semibold">교육원 검색</h1>

      <form method="get" className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={query}
          placeholder="이름 · 지역 검색"
          className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-base"
        />
      </form>

      {!rows || rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {query ? "검색 결과가 없습니다." : "등록된 교육원이 없습니다."}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="text-sm font-semibold">{c.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {c.region || "지역 미입력"}
              </div>
              {(c.phone || c.director_phone) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
                  {c.phone && <span>대표 {c.phone}</span>}
                  {c.director_phone && <span>대표자 {c.director_phone}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
