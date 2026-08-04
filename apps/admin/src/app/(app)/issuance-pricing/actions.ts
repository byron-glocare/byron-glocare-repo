"use server";

import { revalidatePath } from "next/cache";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";

export type PricingResult = { ok: true } | { ok: false; error: string };

async function requireGlocareAdmin(): Promise<PricingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다." };
  return { ok: true };
}

const NOTA = new Set([
  "none",
  "translation_notarization",
  "consul",
  "consul_for_vietnam",
  "apostille",
  "apostille_or_consul",
]);

export async function saveIssuancePricingAction(input: {
  id?: string | null;
  std_key: string;
  label_ko: string;
  notarization: string;
  unit_price: number;
  proxy_unavailable_surcharge: number;
  sort_order: number;
  is_active: boolean;
}): Promise<PricingResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;

  const label = input.label_ko.trim();
  if (!label) return { ok: false, error: "서류명을 입력하세요." };
  if (!NOTA.has(input.notarization))
    return { ok: false, error: "인증 조건이 올바르지 않습니다." };

  const admin = createAdminClient();
  const row = {
    std_key: input.std_key.trim() || null,
    label_ko: label,
    notarization: input.notarization,
    unit_price: Math.max(0, Math.round(input.unit_price || 0)),
    proxy_unavailable_surcharge: Math.max(
      0,
      Math.round(input.proxy_unavailable_surcharge || 0)
    ),
    sort_order: Math.round(input.sort_order || 0),
    is_active: input.is_active,
    updated_at: new Date().toISOString(),
  };

  const { error } = input.id
    ? await admin.from("study_issuance_pricing").update(row).eq("id", input.id)
    : await admin.from("study_issuance_pricing").insert(row);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/issuance-pricing");
  return { ok: true };
}

export async function deleteIssuancePricingAction(
  id: string
): Promise<PricingResult> {
  const guard = await requireGlocareAdmin();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from("study_issuance_pricing")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/issuance-pricing");
  return { ok: true };
}
