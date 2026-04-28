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

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ uni?: string }>;
}) {
  const sp = await searchParams;
  const uniFilter = sp.uni ? Number(sp.uni) : null;

  const supabase = await createClient();
  const [{ data: universities }, { data: depts, error }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, name_ko, emoji")
      .order("id"),
    (uniFilter
      ? supabase
          .from("departments")
          .select("*")
          .eq("university_id", uniFilter)
      : supabase.from("departments").select("*")
    ).order("university_id").order("sort_order"),
  ]);

  const uniMap = new Map<number, { name_ko: string; emoji: string | null }>();
  for (const u of universities ?? []) {
    uniMap.set(u.id, { name_ko: u.name_ko, emoji: u.emoji });
  }

  return (
    <>
      <PageHeader
        title="학과"
        description="유학 도메인 — 대학별 학과 관리"
        breadcrumbs={[{ label: "학과" }]}
        actions={
          <Link href="/departments/new" className={buttonVariants()}>
            <Plus className="size-4" />
            학과 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {/* 필터 */}
        <Card className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-2">
              대학 필터
            </span>
            <Link
              href="/departments"
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                !uniFilter
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted/50"
              }`}
            >
              전체
            </Link>
            {(universities ?? []).map((u) => (
              <Link
                key={u.id}
                href={`/departments?uni=${u.id}`}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  uniFilter === u.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-muted/50"
                }`}
              >
                {u.emoji} {u.name_ko}
              </Link>
            ))}
          </div>
        </Card>

        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !depts || depts.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 학과가 없습니다.{" "}
            <Link
              href="/departments/new"
              className="text-primary hover:underline"
            >
              첫 학과 등록하기 →
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">아이콘</TableHead>
                  <TableHead>학과명</TableHead>
                  <TableHead className="w-44">대학</TableHead>
                  <TableHead className="w-28">코스</TableHead>
                  <TableHead className="w-16 text-center">뱃지</TableHead>
                  <TableHead className="w-16 text-center">정렬</TableHead>
                  <TableHead className="w-16 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {depts.map((d) => {
                  const uni = uniMap.get(d.university_id);
                  const href = `/departments/${d.id}`;
                  return (
                    <TableRow key={d.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={href} className="block">
                          {d.icon ?? "📚"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={href} className="hover:text-primary font-medium">
                          {d.name_ko}
                        </Link>
                        {d.name_vi && (
                          <Link href={href} className="block text-xs text-muted-foreground">
                            {d.name_vi}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Link
                          href={`/universities/${d.university_id}`}
                          className="hover:text-primary"
                        >
                          {uni
                            ? `${uni.emoji ?? "🎓"} ${uni.name_ko}`
                            : `#${d.university_id}`}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Link href={href} className="block">
                          {dash(d.course)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          {d.badge ? (
                            <Badge variant="outline">{d.badge}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        <Link href={href} className="block">
                          {d.sort_order}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          {d.active ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              활성
                            </Badge>
                          ) : (
                            <Badge variant="outline">숨김</Badge>
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
