"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  customerSchema,
  consultationSchema,
  statusFlagsSchema,
  type CustomerInput,
  type ConsultationInput,
  type StatusFlagsInput,
} from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// 고객 코드 자동 발급 — CVN + YYMM + 순번 3자리
// =============================================================================

async function generateCustomerCode(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `CVN${yy}${mm}`;

  const { data } = await supabase
    .from("customers")
    .select("code")
    .ilike("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].code;
    const lastNum = parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(lastNum)) next = lastNum + 1;
  }

  return `${prefix}${String(next).padStart(3, "0")}`;
}

// =============================================================================
// 교육원 매칭 시 '교육원 발굴' 플래그 자동 리셋 (§5.1.2)
// =============================================================================
async function applyCenterFindingAutoReset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  newTrainingCenterId: string | null
) {
  if (newTrainingCenterId) {
    await supabase
      .from("customer_statuses")
      .update({ training_center_finding: false })
      .eq("customer_id", customerId);
  }
}

// 요양원 매칭 시 '요양원 발굴' 플래그 리셋 (§5.1.4)
async function applyCareHomeFindingAutoReset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  newCareHomeId: string | null
) {
  if (newCareHomeId) {
    await supabase
      .from("customer_statuses")
      .update({ care_home_finding: false })
      .eq("customer_id", customerId);
  }
}

// =============================================================================
// 고객 CRUD
// =============================================================================

export async function createCustomer(input: CustomerInput) {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const code = await generateCustomerCode(supabase);

  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.data, code })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  // customer_statuses 는 DB 트리거로 자동 생성됨

  // 교육원 매칭과 함께 등록했다면 발굴 플래그 리셋
  if (parsed.data.training_center_id) {
    await applyCenterFindingAutoReset(
      supabase,
      data.id,
      parsed.data.training_center_id
    );
  }
  if (parsed.data.care_home_id) {
    await applyCareHomeFindingAutoReset(
      supabase,
      data.id,
      parsed.data.care_home_id
    );
  }

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<ActionResult> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await applyCenterFindingAutoReset(
    supabase,
    id,
    parsed.data.training_center_id ?? null
  );
  await applyCareHomeFindingAutoReset(
    supabase,
    id,
    parsed.data.care_home_id ?? null
  );

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true, data: null };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/customers");
  redirect("/customers");
}

// =============================================================================
// 진행 단계 플래그 업데이트
// =============================================================================

export async function updateStatusFlags(
  customerId: string,
  input: StatusFlagsInput
): Promise<ActionResult> {
  const parsed = statusFlagsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_statuses")
    .update(parsed.data)
    .eq("customer_id", customerId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

// =============================================================================
// 상담 일지
// =============================================================================

export async function createConsultation(
  customerId: string,
  input: ConsultationInput
): Promise<ActionResult> {
  const parsed = consultationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // 두 언어 모두 비어있으면 거부
  if (
    !parsed.data.content_vi?.trim() &&
    !parsed.data.content_kr?.trim()
  ) {
    return {
      ok: false,
      error: "상담 내용을 입력해주세요 (베트남어 또는 한국어).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_consultations").insert({
    customer_id: customerId,
    consultation_type: parsed.data.consultation_type,
    content_vi: parsed.data.content_vi ?? null,
    content_kr: parsed.data.content_kr ?? null,
    author_id: user?.id ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}
