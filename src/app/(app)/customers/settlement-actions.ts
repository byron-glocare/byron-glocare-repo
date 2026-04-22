"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  reservationPaymentSchema,
  commissionPaymentSchema,
  eventPaymentSchema,
  welcomePackPaymentSchema,
  type ReservationPaymentInput,
  type CommissionPaymentInput,
  type EventPaymentInput,
  type WelcomePackPaymentInput,
} from "@/lib/validators";
import {
  computeCommissionReceived,
  computeWelcomePackAmounts,
} from "@/lib/settlement";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// 예약 결제
// =============================================================================

export async function createReservationPayment(
  customerId: string,
  input: ReservationPaymentInput
): Promise<ActionResult> {
  const parsed = reservationPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("reservation_payments").insert({
    customer_id: customerId,
    ...parsed.data,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

export async function updateReservationPayment(
  paymentId: string,
  customerId: string,
  input: ReservationPaymentInput
): Promise<ActionResult> {
  const parsed = reservationPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reservation_payments")
    .update(parsed.data)
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

export async function deleteReservationPayment(
  paymentId: string,
  customerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservation_payments")
    .delete()
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

// =============================================================================
// 소개비
// =============================================================================

export async function createCommissionPayment(
  customerId: string,
  input: CommissionPaymentInput
): Promise<ActionResult> {
  const parsed = commissionPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const received = computeCommissionReceived(
    parsed.data.total_amount,
    parsed.data.deduction_amount
  );

  const supabase = await createClient();
  const { error } = await supabase.from("commission_payments").insert({
    customer_id: customerId,
    training_center_id: parsed.data.training_center_id,
    total_amount: parsed.data.total_amount,
    deduction_amount: parsed.data.deduction_amount,
    received_amount: received,
    received_date: parsed.data.received_date,
    tax_invoice_issued: parsed.data.tax_invoice_issued,
    tax_invoice_date: parsed.data.tax_invoice_date,
    status: parsed.data.status,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/settlements");
  return { ok: true, data: null };
}

export async function updateCommissionPayment(
  paymentId: string,
  customerId: string,
  input: CommissionPaymentInput
): Promise<ActionResult> {
  const parsed = commissionPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const received = computeCommissionReceived(
    parsed.data.total_amount,
    parsed.data.deduction_amount
  );

  // 입금 + 세금계산서 모두 완료 시 자동으로 status='completed' 로 올림
  let status = parsed.data.status;
  if (
    parsed.data.received_date &&
    parsed.data.tax_invoice_issued &&
    parsed.data.tax_invoice_date &&
    status !== "completed"
  ) {
    status = "completed";
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_payments")
    .update({
      training_center_id: parsed.data.training_center_id,
      total_amount: parsed.data.total_amount,
      deduction_amount: parsed.data.deduction_amount,
      received_amount: received,
      received_date: parsed.data.received_date,
      tax_invoice_issued: parsed.data.tax_invoice_issued,
      tax_invoice_date: parsed.data.tax_invoice_date,
      status,
    })
    .eq("id", paymentId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/settlements");
  return { ok: true, data: null };
}

export async function deleteCommissionPayment(
  paymentId: string,
  customerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_payments")
    .delete()
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/settlements");
  return { ok: true, data: null };
}

// =============================================================================
// 이벤트 결제 (친구 소개는 양방향 생성)
// =============================================================================

export async function createEventPayment(
  customerId: string,
  input: EventPaymentInput
): Promise<ActionResult> {
  const parsed = eventPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // 친구 소개인 경우 양쪽 customer 에 생성
  if (parsed.data.event_type === "친구 소개" && parsed.data.friend_customer_id) {
    if (parsed.data.friend_customer_id === customerId) {
      return { ok: false, error: "자기 자신을 친구로 등록할 수 없습니다." };
    }

    // 이미 양쪽 중 하나라도 이 조합의 친구 소개가 등록되어 있는지 확인 (중복 방지)
    const { data: existing } = await supabase
      .from("event_payments")
      .select("id")
      .eq("event_type", "친구 소개")
      .or(
        `and(customer_id.eq.${customerId},friend_customer_id.eq.${parsed.data.friend_customer_id}),and(customer_id.eq.${parsed.data.friend_customer_id},friend_customer_id.eq.${customerId})`
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        ok: false,
        error: "이미 이 친구와의 소개 이벤트가 등록되어 있습니다.",
      };
    }

    const { error } = await supabase.from("event_payments").insert([
      {
        customer_id: customerId,
        event_type: parsed.data.event_type,
        amount: parsed.data.amount,
        gift_type: parsed.data.gift_type,
        friend_customer_id: parsed.data.friend_customer_id,
        gift_given: parsed.data.gift_given,
        gift_given_date: parsed.data.gift_given_date,
      },
      {
        customer_id: parsed.data.friend_customer_id,
        event_type: parsed.data.event_type,
        amount: parsed.data.amount,
        gift_type: parsed.data.gift_type,
        friend_customer_id: customerId,
        gift_given: parsed.data.gift_given,
        gift_given_date: parsed.data.gift_given_date,
      },
    ]);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/customers/${customerId}`);
    revalidatePath(`/customers/${parsed.data.friend_customer_id}`);
    return { ok: true, data: null };
  }

  // 일반 이벤트
  const { error } = await supabase.from("event_payments").insert({
    customer_id: customerId,
    event_type: parsed.data.event_type,
    amount: parsed.data.amount,
    gift_type: parsed.data.gift_type,
    friend_customer_id: parsed.data.friend_customer_id,
    gift_given: parsed.data.gift_given,
    gift_given_date: parsed.data.gift_given_date,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

export async function updateEventPayment(
  paymentId: string,
  customerId: string,
  input: EventPaymentInput
): Promise<ActionResult> {
  const parsed = eventPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_payments")
    .update({
      event_type: parsed.data.event_type,
      amount: parsed.data.amount,
      gift_type: parsed.data.gift_type,
      friend_customer_id: parsed.data.friend_customer_id,
      gift_given: parsed.data.gift_given,
      gift_given_date: parsed.data.gift_given_date,
    })
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

export async function deleteEventPayment(
  paymentId: string,
  customerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_payments")
    .delete()
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

// =============================================================================
// 웰컴팩 결제 (고객당 1개 — upsert)
// =============================================================================

export async function upsertWelcomePackPayment(
  customerId: string,
  input: WelcomePackPaymentInput
): Promise<ActionResult> {
  const parsed = welcomePackPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // final/balance 는 계산 함수로 검증
  const { finalAmount, balanceAmount } = computeWelcomePackAmounts(
    parsed.data.total_price,
    parsed.data.discount_amount,
    parsed.data.reservation_amount,
    parsed.data.interim_amount
  );

  // DB 에 final_amount 는 generated column, balance_amount 는 저장
  const supabase = await createClient();

  const row = {
    customer_id: customerId,
    total_price: parsed.data.total_price,
    discount_amount: parsed.data.discount_amount,
    reservation_amount: parsed.data.reservation_amount,
    reservation_date: parsed.data.reservation_date,
    interim_amount: parsed.data.interim_amount,
    interim_date: parsed.data.interim_date,
    balance_amount: parsed.data.balance_amount || balanceAmount,
    balance_date: parsed.data.balance_date,
    sales_reported: parsed.data.sales_reported,
    sales_reported_date: parsed.data.sales_reported_date,
  };

  const { error } = await supabase
    .from("welcome_pack_payments")
    .upsert(row, { onConflict: "customer_id" });
  if (error) return { ok: false, error: error.message };

  // 계산 검증 (finalAmount 는 생성컬럼이라 저장 대상 아님)
  void finalAmount;

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

export async function deleteWelcomePackPayment(
  customerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("welcome_pack_payments")
    .delete()
    .eq("customer_id", customerId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}
