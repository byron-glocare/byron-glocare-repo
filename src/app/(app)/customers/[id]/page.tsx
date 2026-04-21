import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CustomerBasicForm } from "@/components/customer-basic-form";
import { CustomerProgressTab } from "@/components/customer-progress-tab";
import { CustomerConsultationsTab } from "@/components/customer-consultations-tab";
import { ComingSoon } from "@/components/coming-soon";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { computeCustomerStatus } from "@/lib/customer-status";
import { formatDate, dash } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !customer) notFound();

  const [
    { data: status },
    { data: consultations },
    { data: reservationPayments },
    { data: welcomePackPayment },
    { data: smsMessages },
    { data: centers },
    { data: classes },
    { data: homes },
  ] = await Promise.all([
    supabase
      .from("customer_statuses")
      .select("*")
      .eq("customer_id", id)
      .maybeSingle(),
    supabase
      .from("customer_consultations")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reservation_payments")
      .select("payment_date")
      .eq("customer_id", id),
    supabase
      .from("welcome_pack_payments")
      .select("reservation_date")
      .eq("customer_id", id)
      .maybeSingle(),
    supabase
      .from("sms_messages")
      .select("message_type")
      .eq("target_customer_id", id),
    supabase
      .from("training_centers")
      .select("id, code, name, region")
      .order("name"),
    supabase
      .from("training_classes")
      .select("id, training_center_id, year, month, class_type, start_date")
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase.from("care_homes").select("id, code, name, region").order("name"),
  ]);

  // status가 혹시 누락됐다면 default로 채움
  const effectiveStatus = status ?? {
    customer_id: id,
    intake_abandoned: false,
    study_abroad_consultation: false,
    training_center_finding: false,
    training_reservation_abandoned: false,
    certificate_acquired: false,
    training_dropped: false,
    welcome_pack_abandoned: false,
    care_home_finding: false,
    interview_passed: false,
    updated_at: new Date().toISOString(),
  };

  const summary = computeCustomerStatus({
    customer,
    status: effectiveStatus,
    reservationPayments: reservationPayments ?? [],
    welcomePackPayment: welcomePackPayment ?? null,
    smsMessages: smsMessages ?? [],
  });

  const age = customer.birth_year
    ? new Date().getFullYear() - customer.birth_year
    : null;

  return (
    <>
      <PageHeader
        title={customer.name_vi || customer.name_kr || "(이름 없음)"}
        breadcrumbs={[
          { href: "/customers", label: "고객관리" },
          { label: customer.code },
        ]}
        description={
          <>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className="font-mono text-xs">
                {customer.code}
              </Badge>
              {summary.currentStage && <StageChip label={summary.label} />}
              <span className="text-xs text-muted-foreground">
                최초 등록 {formatDate(customer.created_at)} · 마지막 갱신{" "}
                {formatDate(customer.updated_at)}
              </span>
              {age && (
                <span className="text-xs text-muted-foreground">· {age}세</span>
              )}
              {customer.phone && (
                <span className="text-xs text-muted-foreground">
                  · {dash(customer.phone)}
                </span>
              )}
            </div>
          </>
        }
      />
      <div className="p-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList>
            <TabsTrigger value="basic">기본 정보</TabsTrigger>
            <TabsTrigger value="progress">진행 단계</TabsTrigger>
            <TabsTrigger value="consultations">상담 일지</TabsTrigger>
            <TabsTrigger value="settlement">정산</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-6">
            <CustomerBasicForm
              mode="edit"
              customerId={customer.id}
              defaultValues={customer}
              trainingCenters={centers ?? []}
              trainingClasses={classes ?? []}
              careHomes={homes ?? []}
            />
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <CustomerProgressTab
              customerId={customer.id}
              inputs={{
                customer,
                status: effectiveStatus,
                reservationPayments: reservationPayments ?? [],
                welcomePackPayment: welcomePackPayment ?? null,
                smsMessages: smsMessages ?? [],
              }}
            />
          </TabsContent>

          <TabsContent value="consultations" className="mt-6">
            <CustomerConsultationsTab
              customerId={customer.id}
              consultations={consultations ?? []}
            />
          </TabsContent>

          <TabsContent value="settlement" className="mt-6">
            <ComingSoon
              phase="Phase 6"
              description="예약 결제 · 소개비 · 이벤트(친구 소개 양방향) · 웰컴팩(3회차 분할) 4종 정산"
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function StageChip({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  );
}
