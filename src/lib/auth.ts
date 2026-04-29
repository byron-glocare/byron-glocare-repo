/**
 * Auth 유틸리티 — 현재 로그인 사용자 + 매핑된 customer 조회.
 */
import { createClient } from "@/lib/supabase/server";

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
  if (!productType) return false;
  switch (feature) {
    case "videos":
    case "cbt":
      return productType === "교육" || productType === "교육+웰컴팩";
    case "resume":
      return productType === "웰컴팩" || productType === "교육+웰컴팩";
  }
}
