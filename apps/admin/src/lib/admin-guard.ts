import type { User } from "@supabase/supabase-js";

/**
 * 글로케어 내부 어드민 권한 판별.
 *
 * 세 앱(admin/abroad·center/caregiver)이 같은 auth.users 를 공유하므로,
 * "로그인했다"는 것만으로 admin(3001) 접근을 허용하면 유학센터 계정 등도
 * admin 에 들어올 수 있다. 그래서 별도의 역할 플래그로 게이트한다.
 *
 * 판별 기준은 DB RLS 의 study_is_glocare_admin() 과 **동일**:
 *   auth.users.app_metadata.role === 'glocare_admin'
 * (역할은 Supabase Admin API / SQL 로만 설정 가능 — 사용자가 못 바꿈.)
 */
export function isGlocareAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = (user.app_metadata as { role?: unknown } | null | undefined)
    ?.role;
  return role === "glocare_admin";
}
