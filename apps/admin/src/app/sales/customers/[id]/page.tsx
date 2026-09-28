import { notFound } from "next/navigation";

import { requireSales } from "@/lib/sales/guard";
import {
  SalesCustomerPanel,
  type SalesConsultation,
} from "@/components/sales/sales-customer-panel";
import type { IntakeDecision } from "@/lib/sales/types";

export const dynamic = "force-dynamic";

export default async function SalesCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { admin } = await requireSales();

  const [{ data: customer }, { data: status }, { data: consultations }] =
    await Promise.all([
      admin
        .from("customers")
        .select("id, name_vi, name_kr, phone, desired_region, birth_year, visa_type")
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("customer_statuses")
        .select("intake_confirmed, intake_abandoned, intake_persuading")
        .eq("customer_id", id)
        .maybeSingle(),
      admin
        .from("customer_consultations")
        .select("id, consultation_type, content_kr, content_vi, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!customer) notFound();

  const decision: IntakeDecision = status?.intake_confirmed
    ? "yes"
    : status?.intake_abandoned
      ? "no"
      : status?.intake_persuading
        ? "persuade"
        : "none";

  return (
    <SalesCustomerPanel
      customer={customer}
      decision={decision}
      consultations={(consultations ?? []) as SalesConsultation[]}
    />
  );
}
