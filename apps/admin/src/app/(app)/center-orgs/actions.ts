"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type {
  StudyCenterOrgInsert,
  StudyCenterOrgUpdate,
} from "@/types/database";

const STATUSES = ["pending", "active", "suspended", "closed"] as const;
const CURRENCIES = ["KRW", "USD", "VND"] as const;

const schema = z.object({
  name_vi: z.string().min(1).max(200),
  name_ko: z.string().max(200).nullable(),
  country: z.string().min(2).max(10),
  tax_id: z.string().max(50).nullable(),
  status: z.enum(STATUSES),
  settlement_currency: z.enum(CURRENCIES),
  pricing_plan_id: z.string().uuid().nullable(),
});

export type SaveOrgState =
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

export async function saveOrgAction(
  orgId: string | null,
  _prev: SaveOrgState,
  formData: FormData
): Promise<SaveOrgState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const raw = {
    name_vi: formData.get("name_vi"),
    name_ko: emptyToNull(formData.get("name_ko")),
    country: formData.get("country"),
    tax_id: emptyToNull(formData.get("tax_id")),
    status: formData.get("status"),
    settlement_currency: formData.get("settlement_currency"),
    pricing_plan_id: emptyToNull(formData.get("pricing_plan_id")),
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

  // contact_info 조립
  const contact: Record<string, string> = {};
  const primary = emptyToNull(formData.get("contact_primary_name"));
  const phone = emptyToNull(formData.get("contact_phone"));
  const email = emptyToNull(formData.get("contact_email"));
  const website = emptyToNull(formData.get("contact_website"));
  const address = emptyToNull(formData.get("contact_address"));
  if (primary) contact.primary_contact_name = primary;
  if (phone) contact.phone = phone;
  if (email) contact.email = email;
  if (website) contact.website = website;
  if (address) contact.address = address;
  const contactInfo = Object.keys(contact).length > 0 ? contact : null;

  // status=active 변경 시 activated_at stamping (없는 경우만)
  const nowIso = new Date().toISOString();

  if (orgId) {
    // UPDATE
    const { data: existing } = await supabase
      .from("study_center_orgs")
      .select("status, activated_at")
      .eq("id", orgId)
      .maybeSingle();

    const patch: StudyCenterOrgUpdate = {
      name_vi: data.name_vi,
      name_ko: data.name_ko,
      country: data.country,
      tax_id: data.tax_id,
      status: data.status,
      settlement_currency: data.settlement_currency,
      pricing_plan_id: data.pricing_plan_id,
      contact_info: contactInfo,
    };

    // pending → active 첫 전환 시 activated_at 갱신
    if (
      data.status === "active" &&
      existing?.status !== "active" &&
      !existing?.activated_at
    ) {
      patch.activated_at = nowIso;
    }
    // active → closed 시 deactivated_at 갱신
    if (data.status === "closed" && existing?.status !== "closed") {
      patch.deactivated_at = nowIso;
    }

    const { error } = await supabase
      .from("study_center_orgs")
      .update(patch)
      .eq("id", orgId);
    if (error) return { error: `DB UPDATE 실패: ${error.message}` };
  } else {
    // INSERT
    const ins: StudyCenterOrgInsert = {
      name_vi: data.name_vi,
      name_ko: data.name_ko,
      country: data.country,
      tax_id: data.tax_id,
      status: data.status,
      settlement_currency: data.settlement_currency,
      pricing_plan_id: data.pricing_plan_id,
      contact_info: contactInfo,
    };
    if (data.status === "active") {
      ins.activated_at = nowIso;
    }
    const { error } = await supabase.from("study_center_orgs").insert(ins);
    if (error) return { error: `DB INSERT 실패: ${error.message}` };
  }

  revalidatePath("/center-orgs");
  redirect("/center-orgs");
}

export async function deleteOrgAction(orgId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // 인보이스 존재 시 FK RESTRICT 로 막힘
  await supabase.from("study_center_orgs").delete().eq("id", orgId);

  revalidatePath("/center-orgs");
  redirect("/center-orgs");
}
