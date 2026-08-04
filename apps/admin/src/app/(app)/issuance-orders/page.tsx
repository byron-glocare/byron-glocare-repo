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
import { formatDate } from "@/lib/format";

import { ORDER_STATUS_LABEL, orderStatusVariant } from "./status";

export const dynamic = "force-dynamic";

export default async function IssuanceOrdersPage() {
  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("study_issuance_orders")
    .select("id, student_id, university_id, status, subtotal, created_at")
    .order("created_at", { ascending: false });

  const rows = orders ?? [];
  const studentIds = Array.from(new Set(rows.map((o) => o.student_id)));
  const uniIds = Array.from(
    new Set(rows.map((o) => o.university_id).filter((x): x is number => !!x))
  );
  const [{ data: students }, { data: unis }] = await Promise.all([
    studentIds.length > 0
      ? admin
          .from("study_managed_students")
          .select("id, name")
          .in("id", studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    uniIds.length > 0
      ? admin.from("universities").select("id, name_ko").in("id", uniIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name_ko: string }> }),
  ]);
  const nameById = new Map((students ?? []).map((s) => [s.id, s.name]));
  const uniById = new Map((unis ?? []).map((u) => [u.id, u.name_ko]));

  const active = rows.filter(
    (o) => !["done", "cancelled"].includes(o.status)
  ).length;

  return (
    <>
      <PageHeader
        title="발급 대행 (개발중)"
        description="B2C 학생의 발급 서류 대행 주문 — 진행 상태·발급 결과 관리."
        breadcrumbs={[{ label: "발급 대행" }]}
      />
      <div className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          진행 중 {active}건 · 전체 {rows.length}건
        </p>
        {rows.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            발급 대행 주문이 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학생</TableHead>
                  <TableHead className="w-56">제출 대상 대학</TableHead>
                  <TableHead className="w-32 text-right">금액</TableHead>
                  <TableHead className="w-32">상태</TableHead>
                  <TableHead className="w-28">신청일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/issuance-orders/${o.id}`}
                        className="hover:text-primary"
                      >
                        {nameById.get(o.student_id) ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.university_id
                        ? uniById.get(o.university_id) ?? "—"
                        : "공통"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {o.subtotal.toLocaleString()}원
                    </TableCell>
                    <TableCell>
                      <Badge variant={orderStatusVariant(o.status)}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(o.created_at)}
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
