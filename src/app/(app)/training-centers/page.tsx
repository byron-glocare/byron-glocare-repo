import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { REGION1_OPTIONS } from "@/lib/region-options";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  region?: string;
  /**
   * 제휴 상태 필터:
   *  - undefined/"" (기본) : 전체
   *  - "active"            : 제휴중 (partnership_terminated=false)
   *  - "terminated"        : 제휴 종료 (partnership_terminated=true)
   */
  status?: string;
}>;

export default async function TrainingCentersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const regionFilter = sp.region?.trim() ?? "";
  // 기본값 = '제휴중'. 사용자가 명시적으로 'all' 또는 'terminated' 를 골라야만 변경.
  const statusRaw = (sp.status ?? "").trim();
  const statusFilter: "all" | "active" | "terminated" =
    statusRaw === "all" || statusRaw === "terminated" ? statusRaw : "active";

  const supabase = await createClient();

  // 교육원 목록 — q/region/status 필터 DB 레벨 적용
  let query = supabase
    .from("training_centers")
    .select(
      "id, region, name, director_name, phone, tuition_fee_2026, naeil_card_eligible, contract_active, partnership_terminated"
    )
    .order("name", { ascending: true });

  if (q) {
    const safeQ = q.replace(/[,()]/g, " ").trim();
    if (safeQ) {
      query = query.or(
        `name.ilike.%${safeQ}%,director_name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%,region.ilike.%${safeQ}%`
      );
    }
  }
  if (regionFilter) {
    // 1단계만 필터 (시·도) — region 문자열이 "대구 달서구" 처럼 저장되어
    // 있으므로 "대구%" 로 prefix 일치
    query = query.ilike("region", `${regionFilter}%`);
  }
  if (statusFilter === "active") {
    query = query.eq("partnership_terminated", false);
  } else if (statusFilter === "terminated") {
    query = query.eq("partnership_terminated", true);
  }

  const { data: centers, error } = await query;

  // 교육원별 "실제 등록 교육생" 수 집계.
  const { data: enrolled } = await supabase
    .from("customers")
    .select(
      `
      training_center_id,
      termination_reason,
      customer_statuses ( intake_abandoned, study_abroad_consultation,
        training_reservation_abandoned, training_dropped )
      `
    )
    .not("training_center_id", "is", null);

  const countMap = new Map<string, number>();
  for (const row of enrolled ?? []) {
    if (!row.training_center_id) continue;
    if (row.termination_reason) continue;
    const s = Array.isArray(row.customer_statuses)
      ? row.customer_statuses[0]
      : row.customer_statuses;
    if (
      s &&
      (s.intake_abandoned ||
        s.study_abroad_consultation ||
        s.training_reservation_abandoned ||
        s.training_dropped)
    ) {
      continue;
    }
    countMap.set(
      row.training_center_id,
      (countMap.get(row.training_center_id) ?? 0) + 1
    );
  }

  const hasAnyFilter = !!(q || regionFilter || statusFilter !== "active");

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
      <div className="p-6 space-y-4">
        <form method="get" className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-60">
            <label className="text-xs text-muted-foreground block mb-1">
              검색 (이름 · 원장 · 연락처 · 지역)
            </label>
            <div className="relative">
              <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="교육원 이름 / 원장 / 010..."
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              지역
            </label>
            <select
              name="region"
              defaultValue={regionFilter}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-28"
            >
              <option value="">전체</option>
              {REGION1_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              상태
            </label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-28"
            >
              <option value="all">전체</option>
              <option value="active">제휴중</option>
              <option value="terminated">제휴 종료</option>
            </select>
          </div>
          <button type="submit" className={buttonVariants()}>
            적용
          </button>
          {hasAnyFilter && (
            <Link
              href="/training-centers"
              className={buttonVariants({ variant: "ghost" })}
            >
              초기화
            </Link>
          )}
        </form>

        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !centers || centers.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            {hasAnyFilter ? (
              "조건에 맞는 교육원이 없습니다."
            ) : (
              <>
                등록된 교육원이 없습니다.{" "}
                <Link
                  href="/training-centers/new"
                  className="text-primary hover:underline"
                >
                  첫 교육원 등록하기 →
                </Link>
              </>
            )}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-24">지역</TableHead>
                  <TableHead className="w-28">원장</TableHead>
                  <TableHead className="w-36">연락처</TableHead>
                  <TableHead className="w-28 text-right">2026 수강료</TableHead>
                  <TableHead className="w-24 text-center">교육생</TableHead>
                  <TableHead className="w-28 text-center">내일배움</TableHead>
                  <TableHead className="w-24 text-center">계약</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {centers.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/training-centers/${c.id}`}
                        className="hover:text-primary inline-flex items-center gap-2"
                      >
                        <span>{c.name}</span>
                        {c.partnership_terminated && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 bg-destructive/10 text-destructive border-destructive/20"
                          >
                            제휴 종료
                          </Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/training-centers/${c.id}`} className="block">
                        {dash(c.region)}
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
                    <TableCell className="text-center">
                      <Link href={`/training-centers/${c.id}`} className="block">
                        {c.contract_active ? (
                          <Badge className="bg-success/10 text-success border-success/20">
                            ON
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
