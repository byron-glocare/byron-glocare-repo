import Link from "next/link";
import { Building2, Home, Search } from "lucide-react";

import { requireSales } from "@/lib/sales/guard";

export const dynamic = "force-dynamic";

type CustomerRow = {
  id: string;
  name_vi: string | null;
  name_kr: string | null;
  phone: string | null;
  desired_region: string | null;
};

export default async function SalesHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const { admin } = await requireSales();

  // 설득 중 고객 (상단 자동 표시)
  const { data: persuadeStatus } = await admin
    .from("customer_statuses")
    .select("customer_id")
    .eq("intake_persuading", true);
  const persuadeIds = (persuadeStatus ?? []).map((r) => r.customer_id);
  let persuade: CustomerRow[] = [];
  if (persuadeIds.length > 0) {
    const { data } = await admin
      .from("customers")
      .select("id, name_vi, name_kr, phone, desired_region")
      .in("id", persuadeIds)
      .order("created_at", { ascending: false });
    persuade = (data ?? []) as CustomerRow[];
  }

  // 검색 — 전체 대상
  let results: CustomerRow[] = [];
  const safe = query.replace(/[,()]/g, " ").trim();
  if (safe) {
    const { data } = await admin
      .from("customers")
      .select("id, name_vi, name_kr, phone, desired_region")
      .or(
        `name_kr.ilike.%${safe}%,name_vi.ilike.%${safe}%,phone.ilike.%${safe}%,code.ilike.%${safe}%`
      )
      .order("created_at", { ascending: false })
      .limit(50);
    results = (data ?? []) as CustomerRow[];
  }

  return (
    <div className="space-y-5">
      {/* 파트너 리스트 링크 */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/sales/centers"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-3 text-sm font-medium text-muted-foreground active:scale-[0.98]"
        >
          <Building2 className="size-4" />
          교육원 리스트
        </Link>
        <Link
          href="/sales/homes"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-3 text-sm font-medium text-muted-foreground active:scale-[0.98]"
        >
          <Home className="size-4" />
          요양원 리스트
        </Link>
      </div>

      {/* 검색 */}
      <form method="get" className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={query}
          placeholder="교육생 이름 · 전화 · 코드 검색"
          className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-base"
        />
      </form>

      {query ? (
        <CustomerSection
          title={`검색 결과 (${results.length})`}
          rows={results}
          emptyText="검색 결과가 없습니다."
        />
      ) : null}

      <CustomerSection
        title={`설득 중 (${persuade.length})`}
        rows={persuade}
        emptyText="설득 중인 고객이 없습니다."
      />
    </div>
  );
}

function CustomerSection({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: CustomerRow[];
  emptyText: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((c) => {
            const name =
              [c.name_vi, c.name_kr].filter(Boolean).join(" / ") ||
              "(이름 없음)";
            return (
              <li key={c.id}>
                <Link
                  href={`/sales/customers/${c.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 active:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.phone, c.desired_region].filter(Boolean).join(" · ") ||
                        "정보 없음"}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
