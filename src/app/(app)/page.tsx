import Link from "next/link";
import {
  BookOpen,
  Building2,
  Film,
  MessageCircle,
  MessageSquarePlus,
  School,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TaskCards } from "@/components/dashboard/task-cards";
import { StageDistributionChart } from "@/components/dashboard/stage-distribution";
import { NewCustomersCard } from "@/components/dashboard/new-customers-card";
import { CumulativeStatsCard } from "@/components/dashboard/cumulative-stats-card";
import { PartnersStatsCard } from "@/components/dashboard/partners-stats-card";
import { StudyStatsCards } from "@/components/dashboard/study-stats-cards";
import {
  computeTaskBuckets,
  computeStageDistribution,
  computeNewCustomerCounts,
  computeCumulativeCounts,
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
    { count: uniCount },
    { count: deptCount },
    { count: centerCount },
    { count: caseCount },
    { count: contactsTotal },
    { count: contactsPending },
    { count: claimsTotal },
    { count: claimsPending },
    { count: trainingCenterActiveCount },
    { count: careHomeActiveCount },
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
    supabase
      .from("universities")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("study_centers")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("study_cases")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supabase.from("study_contacts").select("id", { count: "exact", head: true }),
    supabase
      .from("study_contacts")
      .select("id", { count: "exact", head: true })
      .eq("status", "미확인"),
    supabase
      .from("study_insurance_claims")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("study_insurance_claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "미확인"),
    supabase
      .from("training_centers")
      .select("id", { count: "exact", head: true })
      .eq("partnership_terminated", false),
    supabase
      .from("care_homes")
      .select("id", { count: "exact", head: true })
      .eq("partnership_terminated", false),
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
  const cumulativeCounts = computeCumulativeCounts(inputs);

  const totalCustomers = customers?.length ?? 0;

  const studyStats = [
    {
      href: "/universities",
      label: "대학교",
      icon: School,
      count: uniCount ?? 0,
    },
    {
      href: "/departments",
      label: "학과",
      icon: BookOpen,
      count: deptCount ?? 0,
    },
    {
      href: "/study-centers",
      label: "유학센터",
      icon: Building2,
      count: centerCount ?? 0,
    },
    {
      href: "/study-cases",
      label: "사례",
      icon: Film,
      count: caseCount ?? 0,
    },
    {
      href: "/students?tab=contacts",
      label: "상담",
      icon: MessageCircle,
      count: contactsTotal ?? 0,
      pending: contactsPending ?? 0,
    },
    {
      href: "/students?tab=insurance",
      label: "보험",
      icon: ShieldCheck,
      count: claimsTotal ?? 0,
      pending: claimsPending ?? 0,
    },
  ];

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

          <div className="space-y-3">
            <NewCustomersCard {...newCustomerCounts} />
            <CumulativeStatsCard {...cumulativeCounts} />
            <PartnersStatsCard
              trainingCenters={trainingCenterActiveCount ?? 0}
              careHomes={careHomeActiveCount ?? 0}
            />
          </div>
        </div>

        {/* 유학생 도메인 stats */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              유학생 도메인
            </h2>
            <span className="text-xs text-muted-foreground">
              ※ 활성 데이터 기준 · 우측 상단 숫자는 미확인 inbox
            </span>
          </div>
          <StudyStatsCards stats={studyStats} />
        </section>
      </div>
    </>
  );
}
