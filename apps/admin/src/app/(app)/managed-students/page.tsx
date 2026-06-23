import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dash, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const VISA_LABEL: Record<string, string> = {
  "D-4": "D-4",
  "D-2": "D-2",
  none: "없음",
  other: "기타",
};
const LOC_LABEL: Record<string, string> = {
  VN: "베트남",
  KR: "한국",
  other: "기타",
};

export default async function ManagedStudentsPage() {
  // service-role 로 모든 org 학생 조회 (admin = glocare_admin, 읽기 전용)
  const admin = createAdminClient();

  const [{ data: students }, { data: orgs }, { data: files }] =
    await Promise.all([
      admin
        .from("study_managed_students")
        .select(
          "id, org_id, name, dob, phone, email, topik_level, current_visa, location, created_at"
        )
        .order("created_at", { ascending: false }),
      admin.from("study_center_orgs").select("id, name_ko, name_vi"),
      admin.from("study_student_submission_files").select("student_id"),
    ]);

  const orgMap = new Map(
    (orgs ?? []).map((o) => [o.id, o.name_ko || o.name_vi])
  );
  const fileCount = new Map<string, number>();
  for (const f of files ?? [])
    fileCount.set(f.student_id, (fileCount.get(f.student_id) ?? 0) + 1);

  const rows = students ?? [];

  return (
    <>
      <PageHeader
        title="유학생"
        description="유학센터에서 등록한 전체 유학생 — 조회 및 다운로드"
        breadcrumbs={[{ label: "유학생" }]}
      />
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          총 {rows.length}명
        </p>
        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 유학생이 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-48">유학센터</TableHead>
                  <TableHead className="w-32">생년월일</TableHead>
                  <TableHead className="w-36">연락처</TableHead>
                  <TableHead className="w-20">TOPIK</TableHead>
                  <TableHead className="w-24">비자</TableHead>
                  <TableHead className="w-20">위치</TableHead>
                  <TableHead className="w-20 text-center">서류</TableHead>
                  <TableHead className="w-28">등록일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const n = fileCount.get(s.id) ?? 0;
                  return (
                    <TableRow key={s.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link
                          href={`/managed-students/${s.id}`}
                          className="hover:text-primary"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {orgMap.get(s.org_id) ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {dash(formatDate(s.dob))}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {dash(s.phone)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {s.topik_level ? `${s.topik_level}급` : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {s.current_visa ? VISA_LABEL[s.current_visa] ?? s.current_visa : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Link href={`/managed-students/${s.id}`} className="block">
                          {s.location ? LOC_LABEL[s.location] ?? s.location : "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        {n > 0 ? (
                          <Badge variant="secondary">{n}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(s.created_at)}
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
