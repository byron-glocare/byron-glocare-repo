"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/** 교육 배정 컨펌 */
export async function confirmEnrollment() {
  const supabase = await createClient();
  await supabase.rpc("confirm_enrollment");
  revalidatePath("/my");
}

/** 알림톡 수신동의 토글 */
export async function setKakaoConsent(formData: FormData) {
  const supabase = await createClient();
  const consent = formData.get("consent") === "on";
  await supabase.rpc("set_kakao_consent", { p_consent: consent });
  revalidatePath("/my");
}
