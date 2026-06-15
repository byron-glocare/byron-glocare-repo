/**
 * Auth 유틸 — 현재 로그인 사용자 + 본인 customer 조회.
 *
 * 자가가입(P3): 로그인했는데 customer 행이 없으면 create_self_customer RPC 로
 * 자동 생성/연결한다. (RPC 는 SECURITY DEFINER — RLS 우회, 본인 행만.)
 *
 * 기능 게이트(P3): product_type + 교육기간(class_start~end_date) 으로 판정.
 *   · 동영상/CBT → 교육 상품 보유 AND 교육 시작일~종료일 구간
 *   · 이력서   → 웰컴팩 상품 보유
 */
import { createClient } from "@/lib/supabase/server";

type ProductType = "교육" | "웰컴팩" | "교육+웰컴팩";

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
        product_type: ProductType | null;
        class_start_date: string | null;
        class_end_date: string | null;
        enrollment_confirmed_at: string | null;
        application_submitted_at: string | null;
      };
    };

const CUSTOMER_COLS =
  "id, code, name_kr, name_vi, phone, email, product_type, class_start_date, class_end_date, enrollment_confirmed_at, application_submitted_at";

export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { kind: "guest" };

  let { data: customer } = await supabase
    .from("customers")
    .select(CUSTOMER_COLS)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // 자가가입 자동 생성/연결 — customer 없으면 RPC 호출 후 재조회
  if (!customer) {
    const meta = (user.user_metadata ?? {}) as Record<string, string>;
    await supabase.rpc("create_self_customer", {
      p_name_kr: meta.full_name ?? meta.name ?? null,
      p_name_vi: null,
      p_phone: (user.phone as string) || meta.phone || null,
    });
    const reread = await supabase
      .from("customers")
      .select(CUSTOMER_COLS)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    customer = reread.data;
  }

  if (!customer) {
    // RPC 실패 등 예외 — 본인확인 흐름으로 폴백
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
      class_start_date: customer.class_start_date,
      class_end_date: customer.class_end_date,
      enrollment_confirmed_at: customer.enrollment_confirmed_at,
      application_submitted_at: customer.application_submitted_at,
    },
  };
}

/**
 * 멤버십·교육기간 기반 기능 접근 판정.
 */
export type MembershipFeature = "videos" | "cbt" | "resume";

type GateCustomer = {
  product_type: ProductType | null;
  class_start_date: string | null;
  class_end_date: string | null;
};

export function hasFeatureAccess(
  customer: GateCustomer,
  feature: MembershipFeature
): boolean {
  const pt = customer.product_type;
  const hasEducation = pt === "교육" || pt === "교육+웰컴팩";
  const hasWelcome = pt === "웰컴팩" || pt === "교육+웰컴팩";

  if (feature === "resume") return hasWelcome;

  // videos / cbt — 교육 상품 보유 + 교육 시작일~종료일 구간만 오픈
  if (!hasEducation) return false;
  const start = customer.class_start_date;
  const end = customer.class_end_date;
  if (!start) return false; // 아직 교육 배정 전
  const today = new Date().toISOString().slice(0, 10);
  if (start > today) return false; // 교육 시작 전
  if (end && today > end) return false; // 교육 종료 후 닫힘
  return true;
}
