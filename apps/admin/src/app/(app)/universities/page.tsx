import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
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

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; region?: string; status?: string }>;

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const regionFilter = (sp.region ?? "").trim();
  const statusFilter = (sp.status ?? "").trim(); // "" | "active" | "hidden"

  const supabase = await createClient();

  const [{ data: universities, error }, { data: depts }, { data: offerings }] =
    await Promise.all([
      supabase
        .from("universities")
        .select(
          "id, active, name_ko, name_vi, region_ko, region_vi, website_url, categories, emoji"
        )
        .order("id", { ascending: true }),
      supabase.from("departments").select("university_id, active"),
      supabase.from("study_offerings").select("university_id, status"),
    ]);

  // 학과 수 (활성)
  const deptCount = new Map<number, number>();
  for (const d of depts ?? []) {
    if (!d.active) continue;
    deptCount.set(d.university_id, (deptCount.get(d.university_id) ?? 0) + 1);
  }
  // 모집 수 (노출 중 = published)
  const offeringCount = new Map<number, number>();
  for (const o of offerings ?? []) {
    if (o.status !== "published") continue;
    offeringCount.set(o.university_id, (offeringCount.get(o.university_id) ?? 0) + 1);
  }

  // 지역 옵션 (한국어 지역 distinct)
  const regionOptions = Array.from(
    new Set((universities ?? []).map((u) => u.region_ko).filter((r): r is string => !!r))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  // 필터 적용 (소규모 — JS 필터)
  const filtered = (universities ?? []).filter((u) => {
    if (statusFilter === "active" && !u.active) return false;
    if (statusFilter === "hidden" && u.active) return false;
    if (regionFilter && u.region_ko !== regionFilter) return false;
    if (q) {
      const hay = `${u.name_ko ?? ""} ${u.name_vi ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const hasFilter = !!(q || regionFilter || statusFilter);

  return (
    <>
      <PageHeader
        title="대학교"
        description="홈페이지에 노출중인 대학교 정보 관리"
        breadcrumbs={[{ label: "대학교" }]}
        actions={
          <Link href="/universities/new" className={buttonVariants()}>
            <Plus className="size-4" />
            대학 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {/* 검색 + 필터 */}
        <form
          method="get"
          action="/universities"
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-60 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">
              검색 (이름 한 · 베)
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="서정대 / Seojeong..."
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">지역</label>
            <select
              name="region"
              defaultValue={regionFilter}
              className="h-8 min-w-32 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">전체</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">상태</label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-8 min-w-28 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">전체</option>
              <option value="active">활성</option>
              <option value="hidden">숨김</option>
            </select>
          </div>
          <button type="submit" className={buttonVariants()}>
            적용
          </button>
          {hasFilter && (
            <Link
              href="/universities"
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
        ) : !universities || universities.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 대학이 없습니다.{" "}
            <Link href="/universities/new" className="text-primary hover:underline">
              첫 대학 등록하기 →
            </Link>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            조건에 맞는 대학이 없습니다.
          </Card>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              전체 {filtered.length}개
            </div>
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름 (한)</TableHead>
                    <TableHead>이름 (베)</TableHead>
                    <TableHead className="w-32">지역</TableHead>
                    <TableHead className="w-40">카테고리</TableHead>
                    <TableHead className="w-20 text-center">학과</TableHead>
                    <TableHead className="w-20 text-center">모집</TableHead>
                    <TableHead className="w-20 text-center">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const href = `/universities/${u.id}`;
                    const offers = offeringCount.get(u.id) ?? 0;
                    return (
                      <TableRow key={u.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link href={href} className="hover:text-primary">
                            {u.name_ko}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <Link href={href} className="block">
                            {dash(u.name_vi)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Link href={href} className="block">
                            {dash(u.region_ko)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Link href={href} className="block">
                            {dash(u.categories)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={href} className="block">
                            <Badge variant="secondary">
                              {deptCount.get(u.id) ?? 0}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={href} className="block">
                            {offers > 0 ? (
                              <Badge className="border-success/20 bg-success/10 text-success">
                                {offers}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={href} className="block">
                            {u.active ? (
                              <Badge className="border-success/20 bg-success/10 text-success">
                                활성
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                숨김
                              </Badge>
                            )}
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
