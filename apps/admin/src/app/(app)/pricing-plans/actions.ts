"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type {
  StudyPricingPlanInsert,
  StudyPricingPlanUpdate,
} from "@/types/database";

const MODELS = ["per_student", "monthly", "percentage", "hybrid"] as const;
const BASIS = ["tuition", "total_paid"] as const;
const CURRENCIES = ["KRW", "USD", "VND"] as const;

const baseSchema = z.object({
  name: z.string().min(1).max(200),
  model: z.enum(MODELS),
  currency: z.enum(CURRENCIES),
  per_student_fee: z.coerce.number().min(0).nullable(),
  monthly_fee: z.coerce.number().min(0).nullable(),
  percentage_rate: z.coerce.number().min(0).max(1).nullable(),
  percentage_basis: z.enum(BASIS).nullable(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type SavePlanState =
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

export async function savePlanAction(
  planId: string | null,
  _prev: SavePlanState,
  formData: FormData
): Promise<SavePlanState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const raw = {
    name: formData.get("name"),
    model: formData.get("model"),
    currency: formData.get("currency"),
    per_student_fee: emptyToNull(formData.get("per_student_fee")),
    monthly_fee: emptyToNull(formData.get("monthly_fee")),
    percentage_rate: emptyToNull(formData.get("percentage_rate")),
    percentage_basis: emptyToNull(formData.get("percentage_basis")),
    notes: emptyToNull(formData.get("notes")),
    is_active: formData.get("is_active") === "on",
    effective_from: emptyToNull(formData.get("effective_from")),
    effective_to: emptyToNull(formData.get("effective_to")),
  };

  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  // 모델별 필수 필드 검증 (DB CHECK 제약과 일치)
  const fe: Record<string, string> = {};
  if (data.model === "per_student" && data.per_student_fee == null) {
    fe.per_student_fee = "학생당 모델은 학생당 요금 필수";
  }
  if (data.model === "monthly" && data.monthly_fee == null) {
    fe.monthly_fee = "월정액 모델은 월정액 필수";
  }
  if (data.model === "percentage") {
    if (data.percentage_rate == null) fe.percentage_rate = "비율 모델은 비율 필수";
    if (data.percentage_basis == null) fe.percentage_basis = "비율 기준 필수";
  }
  if (Object.keys(fe).length > 0) return { fieldErrors: fe };

  // hybrid_params JSON parse
  let hybridParams: unknown = null;
  const hpRaw = formData.get("hybrid_params");
  if (typeof hpRaw === "string" && hpRaw.trim() !== "") {
    try {
      hybridParams = JSON.parse(hpRaw);
    } catch (e) {
      return {
        fieldErrors: {
          hybrid_params: `JSON parse 실패: ${
            e instanceof Error ? e.message : String(e)
          }`,
        },
      };
    }
  }

  if (planId) {
    // UPDATE
    const patch: StudyPricingPlanUpdate = {
      name: data.name,
      model: data.model,
      currency: data.currency,
      per_student_fee: data.per_student_fee,
      monthly_fee: data.monthly_fee,
      percentage_rate: data.percentage_rate,
      percentage_basis: data.percentage_basis,
      hybrid_params: hybridParams,
      notes: data.notes,
      is_active: data.is_active,
      effective_from: data.effective_from,
      effective_to: data.effective_to,
    };
    const { error } = await supabase
      .from("study_pricing_plans")
      .update(patch)
      .eq("id", planId);
    if (error) return { error: `DB UPDATE 실패: ${error.message}` };
  } else {
    // INSERT
    const ins: StudyPricingPlanInsert = {
      name: data.name,
      model: data.model,
      currency: data.currency,
      per_student_fee: data.per_student_fee,
      monthly_fee: data.monthly_fee,
      percentage_rate: data.percentage_rate,
      percentage_basis: data.percentage_basis,
      hybrid_params: hybridParams,
      notes: data.notes,
      is_active: data.is_active,
      effective_from: data.effective_from,
      effective_to: data.effective_to,
    };
    const { error } = await supabase.from("study_pricing_plans").insert(ins);
    if (error) return { error: `DB INSERT 실패: ${error.message}` };
  }

  revalidatePath("/pricing-plans");
  redirect("/pricing-plans");
}

export async function deletePlanAction(planId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("study_pricing_plans").delete().eq("id", planId);

  revalidatePath("/pricing-plans");
  redirect("/pricing-plans");
}
