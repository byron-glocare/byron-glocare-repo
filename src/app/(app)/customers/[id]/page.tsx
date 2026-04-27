import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CustomerEditTabs } from "@/components/customer-edit-tabs";
import { Badge } from "@/components/ui/badge";
import { computeCustomerStatus } from "@/lib/customer-status";
import { isCareHomeSectionLocked } from "@/lib/stage-locks";
import { formatDate, dash } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_TABS = ["basic", "progress", "consultations", "settlement"] as const;
type TabKey = (typeof VALID_TABS)[number];

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey =
    VALID_TABS.includes(sp.tab as TabKey) ? (sp.tab as TabKey) : "basic";
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
    { data: reservationPaymentsFull },
    { data: welcomePackPaymentFull },
    { data: commissionPayments },
    { data: eventPayments },
    { data: smsMessages },
    { data: centers },
    { data: classes },
    { data: homes },
    { data: allCustomers },
    { data: settingsRows },
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
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("welcome_pack_payments")
      .select("*")
      .eq("customer_id", id)
      .maybeSingle(),
    supabase
      .from("commission_payments")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_payments")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
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
      .select(
        "id, training_center_id, year, month, class_type, start_date, end_date"
      )
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase.from("care_homes").select("id, code, name, region").order("name"),
    supabase
      .from("customers")
      .select("id, code, name_kr, name_vi")
      .order("code"),
    supabase.from("system_settings").select("key, value"),
  ]);

  const reservationPayments = reservationPaymentsFull ?? [];
  const welcomePackPayment = welcomePackPaymentFull ?? null;

  // status가 혹시 누락됐다면 default로 채움
  const effectiveStatus = status ?? {
    customer_id: id,
    intake_abandoned: false,
    study_abroad_consultation: false,
    training_center_finding: false,
    class_schedule_confirmation_needed: false,
    training_reservation_abandoned: false,
    certificate_acquired: false,
    training_dropped: false,
    welcome_pack_abandoned: false,
    care_home_finding: false,
    resume_sent: false,
    interview_passed: false,
    updated_at: new Date().toISOString(),
  };

  const summary = computeCustomerStatus({
    customer,
    status: effectiveStatus,
    reservationPayments,
    welcomePackPayment,
    smsMessages: smsMessages ?? [],
  });

  // 기본 정보 탭의 요양원 섹션 잠금 여부 — 진행 단계 탭의 종료 플래그 스코프와 공유
  const careHomeLocked = isCareHomeSectionLocked({
    flags: effectiveStatus,
    termination_reason: customer.termination_reason,
  });

  // system_settings 를 key→value 맵으로
  const settings: Record<string, import("@/types/database").Json | undefined> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = row.value;
  }

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
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono text-xs">
              {customer.code}
            </Badge>
            {summary.currentStage && (
              <Badge variant="outline" className="text-xs">
                {summary.label}
              </Badge>
            )}
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
        }
      />
      <div className="p-6">
        <CustomerEditTabs
          initialTab={tab}
          customer={customer}
          consultations={consultations ?? []}
          reservationPayments={reservationPayments}
          welcomePackPayment={welcomePackPayment}
          commissionPayments={commissionPayments ?? []}
          eventPayments={eventPayments ?? []}
          trainingCenters={centers ?? []}
          trainingClasses={classes ?? []}
          careHomes={homes ?? []}
          customerOptions={(allCustomers ?? []).filter(
            (c) => c.id !== customer.id
          )}
          progressInputs={{
            customer,
            status: effectiveStatus,
            reservationPayments,
            welcomePackPayment,
            smsMessages: smsMessages ?? [],
          }}
          careHomeLocked={careHomeLocked}
          settings={settings}
        />
      </div>
    </>
  );
}
