"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type {
  StudyInvoiceInsert,
  StudyInvoiceUpdate,
  StudySettlementInsert,
} from "@/types/database";

const STATUSES = ["draft", "sent", "paid", "cancelled"] as const;
const CURRENCIES = ["KRW", "USD", "VND"] as const;

const lineItemSchema = z.object({
  description: z.string(),
  qty: z.coerce.number(),
  unit_price: z.coerce.number(),
  amount: z.coerce.number(),
});

const schema = z.object({
  org_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(STATUSES),
  currency: z.enum(CURRENCIES),
  total_amount: z.coerce.number().min(0),
  tax_invoice_url: z.string().max(500).nullable(),
});

export type SaveInvoiceState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | undefined;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export async function saveInvoiceAction(
  invoiceId: string | null,
  _prev: SaveInvoiceState,
  formData: FormData
): Promise<SaveInvoiceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const raw = {
    org_id: formData.get("org_id"),
    period_start: formData.get("period_start"),
    period_end: formData.get("period_end"),
    status: formData.get("status"),
    currency: formData.get("currency"),
    total_amount: formData.get("total_amount"),
    tax_invoice_url: emptyToNull(formData.get("tax_invoice_url")),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  if (new Date(data.period_start) > new Date(data.period_end)) {
    return {
      fieldErrors: { period_end: "기간 종료가 시작보다 빠를 수 없습니다" },
    };
  }

  // line_items JSON
  let lineItems: unknown[] = [];
  const liRaw = formData.get("line_items");
  if (typeof liRaw === "string" && liRaw.trim()) {
    try {
      const parsed = JSON.parse(liRaw);
      if (!Array.isArray(parsed)) throw new Error("array 가 아닙니다");
      // 각 항목 검증
      lineItems = parsed.map((p) => lineItemSchema.parse(p));
    } catch (e) {
      return {
        error: `청구 항목 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  const nowIso = new Date().toISOString();

  if (invoiceId) {
    // UPDATE
    const { data: existing } = await supabase
      .from("study_invoices")
      .select("status, sent_at, paid_at")
      .eq("id", invoiceId)
      .maybeSingle();

    const patch: StudyInvoiceUpdate = {
      period_start: data.period_start,
      period_end: data.period_end,
      line_items: lineItems,
      total_amount: data.total_amount,
      currency: data.currency,
      status: data.status,
      tax_invoice_url: data.tax_invoice_url,
    };

    // status 전환 시 timestamp stamping
    if (data.status === "sent" && existing?.status !== "sent" && !existing?.sent_at) {
      patch.sent_at = nowIso;
    }
    if (data.status === "paid" && existing?.status !== "paid" && !existing?.paid_at) {
      patch.paid_at = nowIso;
    }

    const { error } = await supabase
      .from("study_invoices")
      .update(patch)
      .eq("id", invoiceId);
    if (error) return { error: `DB UPDATE 실패: ${error.message}` };

    revalidatePath("/study-invoices");
    revalidatePath(`/study-invoices/${invoiceId}`);
    redirect(`/study-invoices/${invoiceId}`);
  } else {
    // INSERT
    const ins: StudyInvoiceInsert = {
      org_id: data.org_id,
      period_start: data.period_start,
      period_end: data.period_end,
      line_items: lineItems,
      total_amount: data.total_amount,
      currency: data.currency,
      status: data.status,
      tax_invoice_url: data.tax_invoice_url,
    };
    if (data.status === "sent") ins.sent_at = nowIso;

    const { data: inserted, error } = await supabase
      .from("study_invoices")
      .insert(ins)
      .select("id")
      .single();
    if (error || !inserted) {
      return { error: `DB INSERT 실패: ${error?.message ?? "unknown"}` };
    }

    revalidatePath("/study-invoices");
    redirect(`/study-invoices/${inserted.id}`);
  }
}

export async function deleteInvoiceAction(invoiceId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("study_invoices").delete().eq("id", invoiceId);

  revalidatePath("/study-invoices");
  redirect("/study-invoices");
}

// ============================================================
// 송금 매칭 (B3-4)
// ============================================================

const settlementSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.enum(CURRENCIES),
  received_at: z.string().min(1),
  bank_reference: z.string().max(200).nullable(),
  attached_proof_url: z.string().max(500).nullable(),
  note: z.string().max(1000).nullable(),
});

export type AddSettlementState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
    }
  | undefined;

export async function addSettlementAction(
  _prev: AddSettlementState,
  formData: FormData
): Promise<AddSettlementState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const raw = {
    invoice_id: formData.get("invoice_id"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    received_at: formData.get("received_at"),
    bank_reference: emptyToNull(formData.get("bank_reference")),
    attached_proof_url: emptyToNull(formData.get("attached_proof_url")),
    note: emptyToNull(formData.get("note")),
  };

  const parsed = settlementSchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  const ins: StudySettlementInsert = {
    invoice_id: data.invoice_id,
    amount: data.amount,
    currency: data.currency,
    received_at: new Date(data.received_at).toISOString(),
    bank_reference: data.bank_reference,
    attached_proof_url: data.attached_proof_url,
    matched_by_admin: user.id,
    note: data.note,
  };

  const { error } = await supabase.from("study_settlements").insert(ins);
  if (error) return { error: `DB INSERT 실패: ${error.message}` };

  // 인보이스 납부 합계 확인 → 전액 납부 시 status=paid, paid_at 갱신
  const { data: settlements } = await supabase
    .from("study_settlements")
    .select("amount")
    .eq("invoice_id", data.invoice_id);
  const totalPaid = (settlements ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0
  );

  const { data: inv } = await supabase
    .from("study_invoices")
    .select("total_amount, status, paid_at")
    .eq("id", data.invoice_id)
    .maybeSingle();

  if (inv && totalPaid >= Number(inv.total_amount) && inv.status !== "paid") {
    await supabase
      .from("study_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.invoice_id);
  }

  revalidatePath(`/study-invoices/${data.invoice_id}`);
  revalidatePath("/study-invoices");
  return undefined;
}

export async function deleteSettlementAction(
  settlementId: string,
  invoiceId: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("study_settlements").delete().eq("id", settlementId);

  // 납부 상태 재계산
  const { data: settlements } = await supabase
    .from("study_settlements")
    .select("amount")
    .eq("invoice_id", invoiceId);
  const totalPaid = (settlements ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0
  );

  const { data: inv } = await supabase
    .from("study_invoices")
    .select("total_amount, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (inv && totalPaid < Number(inv.total_amount) && inv.status === "paid") {
    // 납부 완료 → 미납으로 되돌림
    await supabase
      .from("study_invoices")
      .update({ status: "sent", paid_at: null })
      .eq("id", invoiceId);
  }

  revalidatePath(`/study-invoices/${invoiceId}`);
  revalidatePath("/study-invoices");
  redirect(`/study-invoices/${invoiceId}`);
}
