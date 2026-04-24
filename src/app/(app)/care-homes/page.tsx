import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { dash } from "@/lib/format";
import { REGION1_OPTIONS } from "@/lib/region-options";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  region?: string;
}>;

export default async function CareHomesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const regionFilter = sp.region?.trim() ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("care_homes")
    .select(
      "id, name, region, contact_person, contact_phone, bed_capacity, partnership_notes"
    )
    .order("name", { ascending: true });

  if (q) {
    const safeQ = q.replace(/[,()]/g, " ").trim();
    if (safeQ) {
      query = query.or(
        `name.ilike.%${safeQ}%,contact_person.ilike.%${safeQ}%,contact_phone.ilike.%${safeQ}%,region.ilike.%${safeQ}%`
      );
    }
  }
  if (regionFilter) {
    query = query.ilike("region", `${regionFilter}%`);
  }

  const { data: homes, error } = await query;

  const { data: counts } = await supabase
    .from("customers")
    .select("care_home_id")
    .not("care_home_id", "is", null);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    if (row.care_home_id) {
      countMap.set(row.care_home_id, (countMap.get(row.care_home_id) ?? 0) + 1);
    }
  }

  const hasAnyFilter = !!(q || regionFilter);

  return (
    <>
      <PageHeader
        title="요양원"
        description="교육생의 취업처. 매칭/면접 일정을 관리합니다."
        breadcrumbs={[{ label: "요양원" }]}
        actions={
          <Link href="/care-homes/new" className={buttonVariants()}>
            <Plus className="size-4" />
            요양원 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        <form method="get" className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-60">
            <label className="text-xs text-muted-foreground block mb-1">
              검색 (이름 · 담당자 · 전화 · 지역)
            </label>
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="요양원 이름 / 담당자 / 010..."
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              지역
            </label>
            <select
              name="region"
              defaultValue={regionFilter}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-28"
            >
              <option value="">전체</option>
              {REGION1_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonVariants()}>
            적용
          </button>
          {hasAnyFilter && (
            <Link
              href="/care-homes"
              className={buttonVariants({ variant: "ghost" })}
            >
              초기화
            </Link>
          )}
        </form>

        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !homes || homes.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            {hasAnyFilter ? (
              "조건에 맞는 요양원이 없습니다."
            ) : (
              <>
                등록된 요양원이 없습니다.{" "}
                <Link
                  href="/care-homes/new"
                  className="text-primary hover:underline"
                >
                  첫 요양원 등록하기 →
                </Link>
              </>
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-24">지역</TableHead>
                  <TableHead className="w-28">담당자</TableHead>
                  <TableHead className="w-36">담당자 전화</TableHead>
                  <TableHead className="w-28">베드</TableHead>
                  <TableHead className="w-24 text-center">교육생</TableHead>
                  <TableHead>특이사항</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {homes.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/care-homes/${h.id}`}
                        className="hover:text-primary"
                      >
                        {h.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.region)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.contact_person)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.contact_phone)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.bed_capacity)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/care-homes/${h.id}`} className="block">
                        <Badge variant="secondary">
                          {countMap.get(h.id) ?? 0}명
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.partnership_notes)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
