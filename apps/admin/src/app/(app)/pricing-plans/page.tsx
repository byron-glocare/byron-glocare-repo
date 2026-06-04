/**
 * /pricing-plans — 가격 플랜 목록 (B3-1).
 *   4모델: per_student / monthly / percentage / hybrid.
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

const MODEL_LABEL: Record<string, string> = {
  per_student: "학생당",
  monthly: "월정액",
  percentage: "비율",
  hybrid: "혼합",
};

export default async function PricingPlansPage() {
  const supabase = await createClient();

  const { data: plans, error } = await supabase
    .from("study_pricing_plans")
    .select("*")
    .order("created_at", { ascending: false });

  // 각 플랜이 몇 개 org 에 할당되어 있는지
  const { data: orgs } = await supabase
    .from("study_center_orgs")
    .select("pricing_plan_id");
  const orgCount = new Map<string, number>();
  for (const o of orgs ?? []) {
    if (!o.pricing_plan_id) continue;
    orgCount.set(o.pricing_plan_id, (orgCount.get(o.pricing_plan_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="가격 플랜"
        description="유학센터별 청구 모델 (4가지: 학생당 / 월정액 / 비율 / 혼합)"
        breadcrumbs={[{ label: "가격 플랜" }]}
        actions={
          <Link href="/pricing-plans/new" className={buttonVariants()}>
            <Plus className="size-4" />
            플랜 등록
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        {error ? (
          <Card className="p-6 text-sm text-destructive">
            데이터를 불러오지 못했습니다: {error.message}
          </Card>
        ) : !plans || plans.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 등록된 가격 플랜이 없습니다.
            </p>
            <Link
              href="/pricing-plans/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Plus className="size-4" />
              첫 플랜 등록
            </Link>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>모델</TableHead>
                  <TableHead className="text-right">학생당</TableHead>
                  <TableHead className="text-right">월정액</TableHead>
                  <TableHead className="text-right">비율</TableHead>
                  <TableHead>통화</TableHead>
                  <TableHead className="text-center">할당</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead className="text-center w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => {
                  const count = orgCount.get(p.id) ?? 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/pricing-plans/${p.id}/edit`}
                          className="hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.notes ? (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {p.notes}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {MODEL_LABEL[p.model] ?? p.model}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {p.per_student_fee != null
                          ? `${Number(p.per_student_fee).toLocaleString()}원`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {p.monthly_fee != null
                          ? `${Number(p.monthly_fee).toLocaleString()}원`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {p.percentage_rate != null
                          ? `${(Number(p.percentage_rate) * 100).toFixed(2)}%`
                          : "—"}
                      </TableCell>
                      <TableCell>{p.currency}</TableCell>
                      <TableCell className="text-center">
                        {count > 0 ? (
                          <Badge variant="secondary">{count}곳</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.is_active ? (
                          <Badge>활성</Badge>
                        ) : (
                          <Badge variant="outline">비활성</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/pricing-plans/${p.id}/edit`}
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
