/**
 * SMS 테스트용 — DUMCD002 (서울 한빛 교육원) 의 전화번호를 010-2825-4849 로 임시 변경.
 * 테스트 후 원복하려면 set-test-phone.ts revert 형태로 다시 돌릴 것.
 *   npx tsx scripts/set-test-phone.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data, error } = await supabase
    .from("training_centers")
    .update({ phone: "010-2825-4849" })
    .eq("code", "DUMCD002")
    .select("id, name, phone")
    .single();

  if (error) throw error;
  console.log(`updated: ${data.name} → ${data.phone}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
