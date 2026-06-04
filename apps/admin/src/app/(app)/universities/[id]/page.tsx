import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Plus } from "lucide-react";

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

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "어학연수 (D-4)",
  associate_2yr: "전문학사 2년",
  bachelor_3yr_extension: "전공심화 (2+2)",
  bachelor_4yr: "학사 4년",
};

const SPEC_STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  reviewing: "검수 중",
  approved: "승인",
  archived: "보관",
};

export default async function UniversityEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const supabase = await createClient();
  const [{ data: row, error }, { data: depts }, { data: specs }] =
    await Promise.all([
      supabase.from("universities").select("*").eq("id", numericId).single(),
      supabase
        .from("departments")
        .select(
          "id, active, icon, name_ko, name_vi, category, course, badge, sort_order"
        )
        .eq("university_id", numericId)
        .order("sort_order"),
      supabase
        .from("study_admission_specs")
        .select("id, term, program_type, admission_category, status, departments, updated_at")
        .eq("university_id", numericId)
        .order("updated_at", { ascending: false }),
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
                  <TableHead className="w-12">아이콘</TableHead>
                  <TableHead>학과명</TableHead>
                  <TableHead className="w-28">코스</TableHead>
                  <TableHead className="w-20 text-center">뱃지</TableHead>
                  <TableHead className="w-20 text-center">정렬</TableHead>
                  <TableHead className="w-20 text-center">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {depts.map((d) => {
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
                          <Link
                            href={href}
                            className="block text-xs text-muted-foreground"
                          >
                            {d.name_vi}
                          </Link>
                        )}
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
          )}
        </Card>

        {/* 모집요강 — 모집요강 메뉴와 연동 */}
        <Card className="overflow-hidden p-0">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">모집요강</h2>
              <Badge variant="secondary">{specs?.length ?? 0}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admissions/${numericId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <FileText className="size-4" />
                입학서류 (모집요강+양식)
              </Link>
              <Link
                href={`/admissions/new?university_id=${numericId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Plus className="size-4" />
                모집요강 추가
              </Link>
            </div>
          </div>
          {!specs || specs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              등록된 모집요강이 없습니다.{" "}
              <Link href={`/admissions/new?university_id=${numericId}`} className="text-primary hover:underline">
                PDF 업로드로 추가 →
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">학기</TableHead>
                  <TableHead className="w-40">과정</TableHead>
                  <TableHead>학과</TableHead>
                  <TableHead className="w-24 text-center">상태</TableHead>
                  <TableHead className="w-28">갱신</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specs.map((s) => {
                  const href = `/admissions/specs/${s.id}`;
                  const depts = Array.isArray(s.departments)
                    ? (s.departments as Array<{ name?: string }>)
                    : [];
                  const deptNames = depts
                    .map((d) => d?.name)
                    .filter(Boolean) as string[];
                  return (
                    <TableRow key={s.id} className="cursor-pointer">
                      <TableCell className="text-sm">
                        <Link href={href} className="block hover:text-primary font-medium">
                          {s.term}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={href} className="block">
                          {PROGRAM_TYPE_LABEL[s.program_type] ?? s.program_type}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Link href={href} className="block">
                          {deptNames.length === 0
                            ? "—"
                            : deptNames.slice(0, 3).join(" · ") +
                              (deptNames.length > 3 ? ` +${deptNames.length - 3}` : "")}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          {s.status === "approved" ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              {SPEC_STATUS_LABEL[s.status] ?? s.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {SPEC_STATUS_LABEL[s.status] ?? s.status}
                            </Badge>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Link href={href} className="block">
                          {new Date(s.updated_at).toLocaleDateString("ko-KR")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
