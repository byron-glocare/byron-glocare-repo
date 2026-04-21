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
import { dash } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CareHomesPage() {
  const supabase = await createClient();

  const { data: homes, error } = await supabase
    .from("care_homes")
    .select(
      "id, code, name, region, contact_person, contact_phone, bed_capacity, partnership_notes"
    )
    .order("name", { ascending: true });

  const { data: counts } = await supabase
    .from("customers")
    .select("care_home_id")
    .not("care_home_id", "is", null);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    if (row.care_home_id) {
      countMap.set(row.care_home_id, (countMap.get(row.care_home_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <PageHeader
        title="요양원"
        description="교육생의 취업처. 매칭/면접 일정을 관리합니다."
        breadcrumbs={[{ label: "요양원" }]}
        actions={
          <Link href="/care-homes/new" className={buttonVariants()}>
            <Plus className="size-4" />
            요양원 등록
          </Link>
        }
      />
      <div className="p-6">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !homes || homes.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            등록된 요양원이 없습니다.{" "}
            <Link href="/care-homes/new" className="text-primary hover:underline">
              첫 요양원 등록하기 →
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">코드</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-24">지역</TableHead>
                  <TableHead className="w-28">담당자</TableHead>
                  <TableHead className="w-36">담당자 전화</TableHead>
                  <TableHead className="w-28">베드</TableHead>
                  <TableHead className="w-24 text-center">교육생</TableHead>
                  <TableHead>특이사항</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {homes.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/care-homes/${h.id}`} className="hover:text-primary">
                        {dash(h.code)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/care-homes/${h.id}`} className="hover:text-primary">
                        {h.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.region)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.contact_person)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.contact_phone)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.bed_capacity)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/care-homes/${h.id}`} className="block">
                        <Badge variant="secondary">
                          {countMap.get(h.id) ?? 0}명
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                      <Link href={`/care-homes/${h.id}`} className="block">
                        {dash(h.partnership_notes)}
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
