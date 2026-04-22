/**
 * QA 자동화용 임시 테스트 계정 생성 (service_role 필요).
 *   npx tsx scripts/create-test-account.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const EMAIL = "qa-test@glocare-test.local";
const PASSWORD = "qatest2026";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // 기존 있으면 비번 재설정 용도로 사용
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const existing = list.users.find((u) => u.email === EMAIL);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`updated: ${EMAIL} / ${PASSWORD}`);
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`created: ${EMAIL} / ${PASSWORD}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
