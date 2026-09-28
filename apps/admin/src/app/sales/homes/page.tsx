import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";

import { requireSales } from "@/lib/sales/guard";

export const dynamic = "force-dynamic";

export default async function SalesHomesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const { admin } = await requireSales();

  let sel = admin
    .from("care_homes")
    .select("id, name, region, phone, director_phone")
    .eq("partnership_terminated", false);
  const safe = query.replace(/[,()]/g, " ").trim();
  if (safe) sel = sel.or(`name.ilike.%${safe}%,region.ilike.%${safe}%`);
  const { data: rows } = await sel.order("name").limit(80);

  return (
    <div className="space-y-4">
      <Link
        href="/sales"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        뒤로
      </Link>
      <h1 className="text-lg font-semibold">요양원 리스트</h1>

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
          {query ? "검색 결과가 없습니다." : "등록된 요양원이 없습니다."}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((h) => (
            <li key={h.id} className="rounded-lg border border-border bg-card p-3">
              <div className="text-sm font-semibold">{h.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {h.region || "지역 미입력"}
              </div>
              {(h.phone || h.director_phone) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
                  {h.phone && <span>대표 {h.phone}</span>}
                  {h.director_phone && <span>대표자 {h.director_phone}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
