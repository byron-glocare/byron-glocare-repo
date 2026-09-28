import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type FindingKind = "training_center" | "care_home";

export type FindingCustomer = {
  id: string;
  name_kr: string | null;
  name_vi: string | null;
  desired_region: string | null;
};

/**
 * 발굴 필요 고객 목록.
 *   customer_statuses.{training_center_finding|care_home_finding}=true 인 고객.
 *   (플래그가 곧 "발굴 필요" — 매칭되면 자동 해제된다.)
 *   임베드 조인 대신 2단 조회로 타입 단순화.
 */
export async function loadFindingCustomers(
  admin: SupabaseClient<Database>,
  kind: FindingKind
): Promise<FindingCustomer[]> {
  const col =
    kind === "training_center"
      ? "training_center_finding"
      : "care_home_finding";

  const { data: statusRows } = await admin
    .from("customer_statuses")
    .select("customer_id")
    .eq(col, true);

  const ids = (statusRows ?? []).map((r) => r.customer_id);
  if (ids.length === 0) return [];

  const { data: customers } = await admin
    .from("customers")
    .select("id, name_kr, name_vi, desired_region")
    .in("id", ids)
    .order("created_at", { ascending: false });

  return (customers ?? []) as FindingCustomer[];
}
