import { createClient } from "@/lib/supabase/server";
import { isGlocareStaff } from "@/lib/admin-guard";

/**
 * Server Action / Route Handler 에서 호출해 인증된 사용자를 강제.
 *
 * 반환값:
 *   - { user } — 인증된 User 객체
 *   - throw — 401(미로그인)/403(직원 아님) 과 동일한 의미의 에러
 *     (Server Action 에서는 toString 되어 클라이언트로 전달)
 *
 * proxy.ts 가 1차로 차단하지만, 방어적으로 각 서버 로직에서 재확인.
 * 특히 service_role 클라이언트(createAdminClient) 호출 전에는 필수.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  // 같은 auth.users 를 홈페이지 가입 고객·유학센터 계정도 쓴다. 로그인만으로는 부족.
  if (!isGlocareStaff(user)) {
    throw new Error("Forbidden");
  }
  return { user, supabase };
}
