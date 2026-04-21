import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { dash, formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TrainingCentersPage() {
  const supabase = await createClient();

  // 교육원 + 소속 교육생 수 (집계)
  const { data: centers, error } = await supabase
    .from("training_centers")
    .select("id, code, region, name, director_name, phone, tuition_fee_2026, naeil_card_eligible")
    .order("name", { ascending: true });

  // 별도 쿼리: 교육원별 customer count
  const { data: counts } = await supabase
    .from("customers")
    .select("training_center_id")
    .not("training_center_id", "is", null);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    if (row.training_center_id) {
      countMap.set(
        row.training_center_id,
        (countMap.get(row.training_center_id) ?? 0) + 1
      );
    }
  }

  return (
    <>
      <PageHeader
        title="교육원"
        description="요양보호사 교육원과 월별 개강 정보를 관리합니다."
        breadcrumbs={[{ label: "교육원" }]}
        actions={
          <Link href="/training-centers/new" className={buttonVariants()}>
            <Plus className="size-4" />
            교육원 등록
          </Link>
        }
      />
      <div className="p-6">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !centers || centers.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 교육원이 없습니다.{" "}
            <Link
              href="/training-centers/new"
              className="text-primary hover:underline"
            >
              첫 교육원 등록하기 →
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">코드</TableHead>
                  <TableHead className="w-24">지역</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-28">원장</TableHead>
                  <TableHead className="w-36">연락처</TableHead>
                  <TableHead className="w-28 text-right">2026 수강료</TableHead>
                  <TableHead className="w-24 text-center">교육생</TableHead>
                  <TableHead className="w-28 text-center">내일배움</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {centers.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/training-centers/${c.id}`}
                        className="hover:text-primary"
                      >
                        {dash(c.code)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/training-centers/${c.id}`} className="block">
                        {dash(c.region)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/training-centers/${c.id}`}
                        className="hover:text-primary"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/training-centers/${c.id}`} className="block">
                        {dash(c.director_name)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/training-centers/${c.id}`} className="block">
                        {dash(c.phone)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/training-centers/${c.id}`} className="block">
                        {formatCurrency(c.tuition_fee_2026)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/training-centers/${c.id}`} className="block">
                        <Badge variant="secondary">
                          {countMap.get(c.id) ?? 0}명
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/training-centers/${c.id}`} className="block">
                        {c.naeil_card_eligible ? (
                          <Badge className="bg-success/10 text-success border-success/20">
                            가능
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </Link>
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
