/**
 * Auth 유틸리티 — 현재 로그인 사용자 + 매핑된 customer 조회.
 *
 * ⚠️ 개발 단계: BYPASS_GATES=true 로 멤버십 게이트 + 매핑 강제 모두 우회.
 *    런칭 전에 false 로 변경하면 정상 권한 체크 활성.
 */
import { createClient } from "@/lib/supabase/server";

// TODO: 런칭 전 false 로 변경 (멤버십 권한 체크 활성)
const BYPASS_GATES = true;

export type AuthState =
  | { kind: "guest" }
  | {
      kind: "unmapped";
      userId: string;
      email: string | null;
      authMeta: Record<string, unknown> | null;
    }
  | {
      kind: "mapped";
      userId: string;
      email: string | null;
      customer: {
        id: string;
        code: string;
        name_kr: string | null;
        name_vi: string | null;
        phone: string | null;
        email: string | null;
        product_type: "교육" | "웰컴팩" | "교육+웰컴팩" | null;
      };
    };

export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { kind: "guest" };

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, code, name_kr, name_vi, phone, email, product_type"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!customer) {
    // ⚠️ 개발 모드: 매핑 안 됐어도 mapped 처럼 처리 (UI 테스트용)
    if (BYPASS_GATES) {
      const meta = (user.user_metadata ?? {}) as Record<string, string>;
      return {
        kind: "mapped",
        userId: user.id,
        email: user.email ?? null,
        customer: {
          id: `DEV_${user.id.slice(0, 8)}`,
          code: "DEV",
          name_kr: meta.full_name ?? meta.name ?? null,
          name_vi: null,
          phone: null,
          email: user.email ?? null,
          product_type: "교육+웰컴팩", // 모든 권한
        },
      };
    }
    return {
      kind: "unmapped",
      userId: user.id,
      email: user.email ?? null,
      authMeta: (user.user_metadata as Record<string, unknown>) ?? null,
    };
  }

  return {
    kind: "mapped",
    userId: user.id,
    email: user.email ?? null,
    customer: {
      id: customer.id,
      code: customer.code,
      name_kr: customer.name_kr,
      name_vi: customer.name_vi,
      phone: customer.phone,
      email: customer.email,
      product_type: customer.product_type,
    },
  };
}

/**
 * 멤버십 별 권한 — 페이지에서 access guard 용.
 */
export type MembershipFeature = "videos" | "cbt" | "resume";

export function hasFeatureAccess(
  productType: "교육" | "웰컴팩" | "교육+웰컴팩" | null,
  feature: MembershipFeature
): boolean {
  // ⚠️ 개발 모드: 모든 기능 접근 허용
  if (BYPASS_GATES) return true;

  if (!productType) return false;
  switch (feature) {
    case "videos":
    case "cbt":
      return productType === "교육" || productType === "교육+웰컴팩";
    case "resume":
      return productType === "웰컴팩" || productType === "교육+웰컴팩";
  }
}
