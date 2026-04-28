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
            등록된 대학이 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>이름 (한)</TableHead>
                  <TableHead>이름 (베)</TableHead>
                  <TableHead className="w-32">지역</TableHead>
                  <TableHead className="w-40">카테고리</TableHead>
                  <TableHead className="w-20 text-center">학과</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universities.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/universities/${u.id}`}
                        className="hover:text-primary"
                      >
                        {u.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {u.emoji && <span className="mr-1">{u.emoji}</span>}
                      <Link
                        href={`/universities/${u.id}`}
                        className="hover:text-primary"
                      >
                        {u.name_ko}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dash(u.name_vi)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {dash(u.region_ko)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dash(u.categories)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {deptCount.get(u.id) ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {u.active ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          숨김
                        </Badge>
                      )}
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
