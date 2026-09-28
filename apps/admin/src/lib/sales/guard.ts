import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareSales } from "@/lib/admin-guard";

/**
 * /sales 서버 액션·조회용 가드.
 *   세션 사용자 확인 + glocare_sales 권한 강제 후 service_role 클라이언트 반환.
 *   권한 없으면 throw → 호출부에서 Unauthorized 처리.
 */
export async function requireSales() {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user || !isGlocareSales(user)) {
    throw new Error("Unauthorized");
  }
  return { user, admin: createAdminClient() };
}
