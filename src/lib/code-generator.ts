/**
 * 엔티티 코드 자동 발급 — {PREFIX} + YYMM (KST) + 월별 순번 3자리.
 *
 * 예:
 *   CVN2604001 (고객 2026-04 첫번째)
 *   TC2604001  (교육원 2026-04 첫번째)
 *   CH2604001  (요양원 2026-04 첫번째)
 *
 * 기존 레코드와 충돌하지 않도록 해당 prefix 의 가장 큰 순번 +1 로 발급.
 * 다중 동시 insert 에서는 충돌 가능성이 있으나 운영 트래픽상 무시.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type DB = SupabaseClient<Database>;

type CodedTable = "customers" | "training_centers" | "care_homes";

const PREFIX: Record<CodedTable, string> = {
  customers: "CVN",
  training_centers: "TC",
  care_homes: "CH",
};

function kstYYMM(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date());
  const yy = parts.find((p) => p.type === "year")?.value ?? "00";
  const mm = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${yy}${mm}`;
}

export async function generateCode(
  supabase: DB,
  table: CodedTable
): Promise<string> {
  const prefix = `${PREFIX[table]}${kstYYMM()}`;

  const { data } = await supabase
    .from(table)
    .select("code")
    .ilike("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].code;
    if (last) {
      const lastNum = parseInt(last.slice(prefix.length), 10);
      if (Number.isFinite(lastNum)) next = lastNum + 1;
    }
  }

  return `${prefix}${String(next).padStart(3, "0")}`;
}
