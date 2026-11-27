"use server";

import { createClient } from "@/lib/supabase/server";
import { isGlocareAdmin } from "@/lib/admin-guard";
import { translateScholarshipsToVi, type ScholarshipText } from "@/lib/admission/translate-scholarships";

/** 장학금 문구 AI 번역 (한국어 → 베트남어). 저장은 하지 않는다 — 화면 칸을 채우고 사람이 확인·저장. */
export async function translateScholarshipsAction(
  items: ScholarshipText[]
): Promise<{ ok: true; items: ScholarshipText[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isGlocareAdmin(user)) return { ok: false, error: "권한이 없습니다" };
  if (!Array.isArray(items) || items.length > 50) return { ok: false, error: "번역할 장학금이 너무 많습니다" };
  return translateScholarshipsToVi(items);
}
