import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { UniversityForm } from "@/components/university-form";
import { Card } from "@/components/ui/card";
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
import { dash } from "@/lib/format";
import type { UniversityInput } from "@/lib/validators";

export const dynamic = "force-dynamic";

export default async function UniversityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const [{ data: row, error }, { data: depts }] = await Promise.all([
    supabase.from("universities").select("*").eq("id", numericId).single(),
    supabase
      .from("departments")
      .select(
        "id, active, icon, name_ko, name_vi, category, course, badge, sort_order"
      )
      .eq("university_id", numericId)
      .order("sort_order"),
  ]);

  if (error || !row) notFound();

  const defaultValues: Partial<UniversityInput> = {
    active: row.active,
    name_ko: row.name_ko,
    name_vi: row.name_vi,
    region_ko: row.region_ko,
    region_vi: row.region_vi,
    logo_url: row.logo_url,
    photo_url: row.photo_url,
    website_url: row.website_url,
    desc_ko: row.desc_ko,
    desc_vi: row.desc_vi,
    class_days_ko: row.class_days_ko,
    class_days_vi: row.class_days_vi,
    transport_bus: row.transport_bus,
    transport_subway: row.transport_subway,
    transport_train: row.transport_train,
    transport_desc_ko: row.transport_desc_ko,
    transport_desc_vi: row.transport_desc_vi,
    dormitory: row.dormitory,
    dormitory_desc_ko: row.dormitory_desc_ko,
    dormitory_desc_vi: row.dormitory_desc_vi,
    strengths: row.strengths,
    tags_ko: row.tags_ko,
    tags_vi: row.tags_vi,
    categories: row.categories,
    emoji: row.emoji,
  };

  return (
    <>
      <PageHeader
        title={`${row.emoji ?? "🎓"} ${row.name_ko}`}
        description={`대학 #${numericId}`}
        breadcrumbs={[
          { href: "/universities", label: "대학교" },
          { label: row.name_ko },
        ]}
      />
      <div className="p-6 space-y-6">
        <UniversityForm
          mode="edit"
          universityId={numericId}
          defaultValues={defaultValues}
        />

        <Card className="overflow-hidden p-0">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">학과</h2>
              <Badge variant="secondary">{depts?.length ?? 0}</Badge>
            </div>
            <Link
              href={`/departments/new?university_id=${numericId}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Plus className="size-4" />
              학과 추가
            </Link>
          </div>
          {!depts || depts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              등록된 학과가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-12">아이콘</TableHead>
                  <TableHead>학과명</TableHead>
                  <TableHead className="w-28">코스</TableHead>
                  <TableHead className="w-20 text-center">뱃지</TableHead>
                  <TableHead className="w-20 text-center">정렬</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {depts.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/departments/${d.id}`}
                        className="hover:text-primary"
                      >
                        {d.id}
                      </Link>
                    </TableCell>
                    <TableCell>{d.icon ?? "📚"}</TableCell>
                    <TableCell>
                      <Link
                        href={`/departments/${d.id}`}
                        className="hover:text-primary font-medium"
                      >
                        {d.name_ko}
                      </Link>
                      {d.name_vi && (
                        <div className="text-xs text-muted-foreground">
                          {d.name_vi}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dash(d.course)}
                    </TableCell>
                    <TableCell className="text-center">
                      {d.badge ? (
                        <Badge variant="outline">{d.badge}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {d.sort_order}
                    </TableCell>
                    <TableCell className="text-center">
                      {d.active ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="outline">숨김</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
