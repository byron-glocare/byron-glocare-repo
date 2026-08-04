"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { ORDER_STATUSES } from "../status";

const BUCKET = "student-files";
const MAX = 20 * 1024 * 1024;

export type OrderResult = { ok: true } | { ok: false; error: string };

async function guard(): Promise<OrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

/** 상태·ETA·메모 갱신. status 변경 시 shipped→shipped_at 자동 기록. */
export async function updateIssuanceOrderAction(input: {
  id: string;
  status?: string;
  eta_date?: string | null;
  manager_note?: string | null;
}): Promise<OrderResult> {
  const g = await guard();
  if (!g.ok) return g;
  const admin = createAdminClient();

  const patch: {
    updated_at: string;
    status?: string;
    eta_date?: string | null;
    manager_note?: string | null;
    shipped_at?: string;
    paid_at?: string;
  } = { updated_at: new Date().toISOString() };
  if (input.status !== undefined) {
    if (!ORDER_STATUSES.includes(input.status as (typeof ORDER_STATUSES)[number]))
      return { ok: false, error: "상태값이 올바르지 않습니다." };
    patch.status = input.status;
    if (input.status === "shipped") patch.shipped_at = new Date().toISOString();
    if (input.status === "paid") patch.paid_at = new Date().toISOString();
  }
  if (input.eta_date !== undefined)
    patch.eta_date = input.eta_date ? input.eta_date : null;
  if (input.manager_note !== undefined)
    patch.manager_note = input.manager_note ? input.manager_note : null;

  const { error } = await admin
    .from("study_issuance_orders")
    .update(patch)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/issuance-orders/${input.id}`);
  revalidatePath("/issuance-orders");
  return { ok: true };
}

export async function cancelIssuanceOrderAction(input: {
  id: string;
  reason: string;
}): Promise<OrderResult> {
  const g = await guard();
  if (!g.ok) return g;
  const admin = createAdminClient();
  const { error } = await admin
    .from("study_issuance_orders")
    .update({
      status: "cancelled",
      cancel_reason: input.reason.trim() || null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/issuance-orders/${input.id}`);
  revalidatePath("/issuance-orders");
  return { ok: true };
}

/** 발급 결과 PDF 업로드 → result_pdf_path 기록(비공개 버킷). */
export async function uploadResultPdfAction(
  formData: FormData
): Promise<OrderResult> {
  const g = await guard();
  if (!g.ok) return g;

  const id = String(formData.get("orderId") ?? "");
  const file = formData.get("file");
  if (!id) return { ok: false, error: "주문 정보가 없습니다." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "파일이 올바르지 않습니다." };
  if (file.size > MAX) return { ok: false, error: "파일이 너무 큽니다(최대 20MB)." };

  const admin = createAdminClient();
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `issuance/${id}/${Date.now()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: file.type || "application/pdf",
      upsert: false,
    });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: prev } = await admin
    .from("study_issuance_orders")
    .select("result_pdf_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin
    .from("study_issuance_orders")
    .update({ result_pdf_path: path, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }
  if (prev?.result_pdf_path && prev.result_pdf_path !== path)
    await admin.storage.from(BUCKET).remove([prev.result_pdf_path]);

  revalidatePath(`/issuance-orders/${id}`);
  return { ok: true };
}

export async function getResultPdfUrlAction(
  path: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const g = await guard();
  if (!g.ok) return g;
  if (!path.startsWith("issuance/"))
    return { ok: false, error: "경로가 올바르지 않습니다." };
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error || !data)
    return { ok: false, error: error?.message ?? "링크 생성 실패." };
  return { ok: true, url: data.signedUrl };
}
