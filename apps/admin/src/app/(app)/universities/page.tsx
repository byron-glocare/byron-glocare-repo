import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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

export default async function UniversitiesPage() {
  const supabase = await createClient();

  const [{ data: universities, error }, { data: depts }] = await Promise.all([
    supabase
      .from("universities")
      .select(
        "id, active, name_ko, name_vi, region_ko, region_vi, website_url, categories, emoji"
      )
      .order("id", { ascending: true }),
    supabase
      .from("departments")
      .select("university_id, active"),
  ]);

  const deptCount = new Map<number, number>();
  for (const d of depts ?? []) {
    if (!d.active) continue;
    deptCount.set(d.university_id, (deptCount.get(d.university_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="대학교"
        description="유학 도메인 — 한국 협력 대학 마스터 데이터"
        breadcrumbs={[{ label: "대학교" }]}
        actions={
          <Link href="/universities/new" className={buttonVariants()}>
            <Plus className="size-4" />
            대학 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !universities || universities.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 대학이 없습니다.{" "}
            <Link
              href="/universities/new"
              className="text-primary hover:underline"
            >
              첫 대학 등록하기 →
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름 (한)</TableHead>
                  <TableHead>이름 (베)</TableHead>
                  <TableHead className="w-32">지역</TableHead>
                  <TableHead className="w-40">카테고리</TableHead>
                  <TableHead className="w-20 text-center">학과</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universities.map((u) => {
                  const href = `/universities/${u.id}`;
                  return (
                    <TableRow key={u.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link href={href} className="hover:text-primary">
                          {u.emoji && <span className="mr-1">{u.emoji}</span>}
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
                          {u.active ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              활성
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
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
        )}
      </div>
    </>
  );
}
