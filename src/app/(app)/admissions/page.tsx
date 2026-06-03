/**
 * /admissions — 모집요강(study_admission_specs) 목록.
 *
 * 운영자(글로케어)가 모집요강을 추가·검수·승인하는 화면.
 * status='approved' 인 spec 만 유학센터 어드민(/center/admissions)에서 조회 가능.
 *
 * 본 페이지의 목록은 모든 status 노출 (draft/reviewing/approved/archived).
 */

import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AdmissionTabs } from "@/components/admission/admission-tabs";
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

const PROGRAM_TYPE_LABEL: Record<string, string> = {
  language_program: "어학연수 (D-4)",
  associate_2yr: "전문학사 2년",
  bachelor_3yr_extension: "전공심화 (2+2)",
  bachelor_4yr: "학사 4년",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  reviewing: "검수 중",
  approved: "승인",
  archived: "보관",
};

type AdmissionSpecRow = {
  id: string;
  university_id: number;
  term: string;
  admission_category: string | null;
  program_type: string;
  status: string;
  departments: unknown;
  source_file_url: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export default async function AdmissionsPage() {
  const supabase = await createClient();

  const { data: specs, error } = await supabase
    .from("study_admission_specs")
    .select(
      "id, university_id, term, admission_category, program_type, status, departments, source_file_url, approved_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });

  // university_id → name_ko join
  const universityIds = Array.from(
    new Set((specs ?? []).map((s) => s.university_id))
  );
  const { data: universities } =
    universityIds.length > 0
      ? await supabase
          .from("universities")
          .select("id, name_ko")
          .in("id", universityIds)
      : { data: [] as Array<{ id: number; name_ko: string }> };
  const uniMap = new Map(
    (universities ?? []).map((u) => [u.id, u.name_ko])
  );

  function deptCount(departments: unknown): number {
    return Array.isArray(departments) ? departments.length : 0;
  }

  function statusBadge(status: string) {
    const label = STATUS_LABEL[status] ?? status;
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            {label}
          </Badge>
        );
      case "reviewing":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            {label}
          </Badge>
        );
      case "draft":
        return <Badge variant="outline">{label}</Badge>;
      case "archived":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {label}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  }

  const total = specs?.length ?? 0;
  const approvedCount =
    specs?.filter((s) => s.status === "approved").length ?? 0;

  return (
    <>
      <PageHeader
        title="모집요강"
        description={`등록된 대학·학과의 모집요강 + 서류 양식 관리 (총 ${total}건 · 승인 ${approvedCount}건)`}
        breadcrumbs={[{ label: "모집요강" }]}
        actions={
          <Link href="/admissions/new" className={buttonVariants()}>
            <Plus className="size-4" />
            모집요강 추가
          </Link>
        }
      />
      <AdmissionTabs active="specs" />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !specs || specs.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 모집요강이 없습니다.{" "}
            <Link
              href="/admissions/new"
              className="text-primary hover:underline"
            >
              PDF 업로드 후 AI 추출 시작 →
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대학교</TableHead>
                  <TableHead>학과</TableHead>
                  <TableHead className="w-36">과정</TableHead>
                  <TableHead className="w-28">학기</TableHead>
                  <TableHead className="w-24 text-center">상태</TableHead>
                  <TableHead className="w-28">갱신</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specs.map((s: AdmissionSpecRow) => {
                  const href = `/admissions/${s.id}`;
                  const depts = Array.isArray(s.departments)
                    ? (s.departments as Array<{ name?: string }>)
                    : [];
                  const deptNames = depts
                    .map((d) => d?.name)
                    .filter(Boolean) as string[];
                  return (
                    <TableRow key={s.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link href={href} className="hover:text-primary">
                          {uniMap.get(s.university_id) ?? "?"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={href} className="block">
                          {deptNames.length === 0
                            ? "—"
                            : deptNames.length === 1
                              ? deptNames[0]
                              : (
                                  <>
                                    {deptNames.slice(0, 3).join(" · ")}
                                    {deptNames.length > 3 ? (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        +{deptNames.length - 3}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={href} className="block">
                          {PROGRAM_TYPE_LABEL[s.program_type] ??
                            s.program_type}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={href} className="block">
                          {s.term}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={href} className="block">
                          {statusBadge(s.status)}
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
          </Card>
        )}
      </div>
    </>
  );
}
