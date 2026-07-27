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
import { formatDate, dash } from "@/lib/format";

import { RequestRowActions } from "./request-actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "secondary" | "default" | "outline" }> = {
  pending: { label: "대기", variant: "default" },
  added: { label: "추가됨", variant: "secondary" },
  rejected: { label: "거절", variant: "outline" },
};

export default async function UniversityRequestsPage() {
  const admin = createAdminClient();

  const { data: requests } = await admin
    .from("study_university_requests")
    .select(
      "id, university_name, university_url, note, status, student_id, resolved_university_id, created_at"
    )
    .order("created_at", { ascending: false });

  const rows = requests ?? [];
  const studentIds = Array.from(
    new Set(rows.map((r) => r.student_id).filter((x): x is string => !!x))
  );
  const { data: students } =
    studentIds.length > 0
      ? await admin
          .from("study_managed_students")
          .select("id, name")
          .in("id", studentIds)
      : { data: [] as Array<{ id: string; name: string }> };
  const nameById = new Map((students ?? []).map((s) => [s.id, s.name]));

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader
        title="대학 요청 (개발중)"
        description="B2C 학생이 요청한 미등록 대학 — 승인하면 자유 지원 카탈로그에 추가됩니다."
        breadcrumbs={[{ label: "대학 요청" }]}
      />
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          대기 {pendingCount}건 · 전체 {rows.length}건
        </p>
        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            요청이 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>대학명</TableHead>
                  <TableHead className="w-56">홈페이지</TableHead>
                  <TableHead>메모</TableHead>
                  <TableHead className="w-32">요청 학생</TableHead>
                  <TableHead className="w-24">상태</TableHead>
                  <TableHead className="w-28">요청일</TableHead>
                  <TableHead className="w-40 text-right">처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = STATUS[r.status] ?? {
                    label: r.status,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.university_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.university_url ? (
                          <a
                            href={r.university_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary hover:underline break-all"
                          >
                            {r.university_url}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs whitespace-pre-wrap">
                        {dash(r.note)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.student_id ? nameById.get(r.student_id) ?? "—" : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" ? (
                          <RequestRowActions requestId={r.id} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            처리됨
                          </span>
                        )}
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
