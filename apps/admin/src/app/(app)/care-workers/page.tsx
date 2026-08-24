import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
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

/**
 * 요양보호사 — 근무 중(work_start_date 있고 종료 안 됨)인 교육생을
 * 근무 시작일 순으로 1호·2호·3호 넘버링. 클릭 시 교육생 상세로 이동.
 */
export default async function CareWorkersPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: workers, error } = await supabase
    .from("customers")
    .select("id, code, name_kr, name_vi, work_start_date")
    .not("work_start_date", "is", null)
    .or(`work_end_date.is.null,work_end_date.gt.${today}`)
    .order("work_start_date", { ascending: true });

  return (
    <>
      <PageHeader title="요양보호사" breadcrumbs={[{ label: "요양보호사" }]} />
      <div className="p-6">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !workers || workers.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            근무 중인 요양보호사가 없습니다.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">번호</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead className="w-40">근무 시작일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((w, i) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-semibold whitespace-nowrap">
                        {i + 1}호
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/customers/${w.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {dash(w.name_kr || w.name_vi)}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(w.work_start_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
