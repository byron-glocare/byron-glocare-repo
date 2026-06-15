"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * 신청서 제출 — submit_application RPC (SECURITY DEFINER) 호출.
 * 본인 customer 가 없으면 RPC 내부에서 생성 후 신청서 필드 갱신.
 */
export async function submitApplication(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/apply");

  const get = (k: string) => {
    const v = formData.get(k);
    const s = v ? String(v).trim() : "";
    return s.length > 0 ? s : null;
  };
  const birthRaw = get("birth_year");

  await supabase.rpc("submit_application", {
    p_name_kr: get("name_kr"),
    p_name_vi: get("name_vi"),
    p_phone: get("phone"),
    p_birth_year: birthRaw ? Number(birthRaw) : null,
    p_address: get("address"),
    p_desired_region: get("desired_region"),
    p_topik_level: get("topik_level"),
    p_visa_type: get("visa_type"),
  });

  redirect("/my");
}
