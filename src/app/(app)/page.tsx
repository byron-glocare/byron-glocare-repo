import Link from "next/link";
import { MessageSquarePlus, UserPlus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TaskCards } from "@/components/dashboard/task-cards";
import { StageDistributionChart } from "@/components/dashboard/stage-distribution";
import { NewCustomersCard } from "@/components/dashboard/new-customers-card";
import {
  computeTaskBuckets,
  computeStageDistribution,
  computeNewCustomerCounts,
} from "@/lib/dashboard";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: customers },
    { data: statuses },
    { data: reservationPayments },
    { data: welcomePackPayments },
    { data: smsMessages },
  ] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("customer_statuses").select("*"),
    supabase
      .from("reservation_payments")
      .select("customer_id, payment_date"),
    supabase
      .from("welcome_pack_payments")
      .select("customer_id, reservation_date"),
    supabase
      .from("sms_messages")
      .select("target_customer_id, message_type"),
  ]);

  const inputs = {
    customers: customers ?? [],
    statuses: statuses ?? [],
    reservationPayments: reservationPayments ?? [],
    welcomePackPayments: welcomePackPayments ?? [],
    smsMessages: smsMessages ?? [],
  };

  const taskBuckets = computeTaskBuckets(inputs);
  const stageDistribution = computeStageDistribution(inputs);
  const newCustomerCounts = computeNewCustomerCounts(customers ?? []);

  const totalCustomers = customers?.length ?? 0;

  return (
    <>
      <PageHeader
        title="대시보드"
        description={`전체 ${totalCustomers}명 · 처리해야 할 작업과 단계별 분포를 한눈에 확인합니다.`}
      />
      <div className="p-6 space-y-6">
        {/* 빠른 작업 버튼 */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/customers/new" className={buttonVariants()}>
            <UserPlus className="size-4" />
            신규 고객 추가
          </Link>
          <Link
            href="/consultations/new"
            className={buttonVariants({ variant: "outline" })}
          >
            <MessageSquarePlus className="size-4" />
            상담 일지 작성
          </Link>
        </div>

        {/* 처리 작업 8종 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              처리해야 할 작업
            </h2>
          </div>
          <TaskCards buckets={taskBuckets} />
        </section>

        {/* 하단 2열: 단계 분포 + 신규 고객 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">단계별 고객 분포</CardTitle>
              <CardDescription>
                자동 판정된 현재 단계 기준. 접수포기·교육드랍·종료는 모두 "종료"로 집계.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StageDistributionChart distribution={stageDistribution} />
            </CardContent>
          </Card>

          <NewCustomersCard {...newCustomerCounts} />
        </div>
      </div>
    </>
  );
}
