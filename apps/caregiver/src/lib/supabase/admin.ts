import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Service Role 클라이언트 — RLS 우회. **서버에서만** 사용.
 * 결제 확정(record_payment_paid) 등 토스 서버 검증 직후의 신뢰된 기록에만.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
