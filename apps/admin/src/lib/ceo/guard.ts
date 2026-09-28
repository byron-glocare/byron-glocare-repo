import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareCeo } from "@/lib/admin-guard";

/**
 * /ceo 서버 액션·조회용 가드.
 *   세션에서 사용자를 확인하고 glocare_ceo 권한을 강제한 뒤,
 *   service_role 클라이언트(admin)를 반환한다. (RLS 우회 — 대표님은
 *   교육원/요양원 등록·발굴필요 해제를 해야 하므로.)
 *   권한 없으면 throw → 호출부에서 Unauthorized 처리.
 */
export async function requireCeo() {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user || !isGlocareCeo(user)) {
    throw new Error("Unauthorized");
  }
  return { user, admin: createAdminClient() };
}
