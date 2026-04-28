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

export default async function StudyCentersPage() {
  const supabase = await createClient();

  const { data: centers, error } = await supabase
    .from("study_centers")
    .select("*")
    .order("id", { ascending: true });

  return (
    <>
      <PageHeader
        title="유학센터"
        description="유학 도메인 — 베트남 협력 유학 센터"
        breadcrumbs={[{ label: "유학센터" }]}
        actions={
          <Link href="/study-centers/new" className={buttonVariants()}>
            <Plus className="size-4" />
            센터 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !centers || centers.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 센터가 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>센터명 (베)</TableHead>
                  <TableHead>센터명 (한)</TableHead>
                  <TableHead className="w-32">도시</TableHead>
                  <TableHead className="w-36">전화</TableHead>
                  <TableHead className="w-48">이메일</TableHead>
                  <TableHead className="w-28">학생수</TableHead>
                  <TableHead className="w-28">운영기간</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {centers.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/study-centers/${c.id}`}
                        className="hover:text-primary"
                      >
                        {c.id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.flag && <span className="mr-1">{c.flag}</span>}
                      <Link
                        href={`/study-centers/${c.id}`}
                        className="hover:text-primary"
                      >
                        {c.name_vi}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dash(c.name_ko)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {dash(c.city_ko ?? c.city_vi)}
                    </TableCell>
                    <TableCell className="text-xs">{dash(c.phone)}</TableCell>
                    <TableCell className="text-xs">{dash(c.email)}</TableCell>
                    <TableCell className="text-xs">
                      {dash(c.students_ko ?? c.students_vi)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {dash(c.years_ko ?? c.years_vi)}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.active ? (
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
