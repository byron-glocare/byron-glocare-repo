/**
 * /center-orgs — 유학센터 회사 목록 (B3-2).
 *   B2B 청구 단위. 각 org 에 가격 플랜 할당 → 인보이스 발행 단위.
 */

import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
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

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  active: "활성",
  suspended: "정지",
  closed: "종료",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  active: "default",
  suspended: "secondary",
  closed: "destructive",
};

export default async function CenterOrgsPage() {
  const supabase = await createClient();

  const [{ data: orgs, error }, { data: plans }] = await Promise.all([
    supabase
      .from("study_center_orgs")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("study_pricing_plans").select("id, name, model"),
  ]);

  const planMap = new Map(
    (plans ?? []).map((p) => [p.id, p])
  );

  return (
    <>
      <PageHeader
        title="유학센터 회사"
        description="B2B 청구 단위. 각 회사에 가격 플랜 할당."
        breadcrumbs={[{ label: "유학센터 회사" }]}
        actions={
          <Link href="/center-orgs/new" className={buttonVariants()}>
            <Plus className="size-4" />
            회사 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !orgs || orgs.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 등록된 유학센터 회사가 없습니다.
            </p>
            <Link
              href="/center-orgs/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Plus className="size-4" />첫 회사 등록
            </Link>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>회사명</TableHead>
                  <TableHead>국가</TableHead>
                  <TableHead>세무번호</TableHead>
                  <TableHead>가격 플랜</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead>활성화일</TableHead>
                  <TableHead className="text-right">조치</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((o) => {
                  const plan = o.pricing_plan_id ? planMap.get(o.pricing_plan_id) : null;
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/center-orgs/${o.id}/edit`}
                          className="font-medium hover:underline"
                        >
                          {o.name_vi}
                        </Link>
                        {o.name_ko ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {o.name_ko}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{o.country}</TableCell>
                      <TableCell className="text-sm">{o.tax_id ?? "—"}</TableCell>
                      <TableCell>
                        {plan ? (
                          <Link
                            href={`/pricing-plans/${plan.id}/edit`}
                            className="text-sm hover:underline"
                          >
                            {plan.name}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({plan.model})
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            미할당
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.activated_at
                          ? new Date(o.activated_at).toLocaleDateString("ko-KR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/center-orgs/${o.id}/edit`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          편집
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
