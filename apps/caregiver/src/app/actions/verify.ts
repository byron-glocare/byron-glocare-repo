"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const verifySchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요. / Vui lòng nhập tên."),
  phone: z
    .string()
    .trim()
    .min(1, "전화번호를 입력해주세요. / Vui lòng nhập số điện thoại."),
});

export type VerifyInput = z.input<typeof verifySchema>;

export type VerifyResult =
  | { ok: true; mapped: true; customerId: string }
  | { ok: true; mapped: false; reason: "no_match" | "already_mapped" }
  | { ok: false; error: string };

/**
 * 본인 확인 — 이름·전화 일치하는 unmapped customer 찾아 현재 auth user 와 link.
 *
 * 매칭 규칙:
 *  - phone 정확히 일치 (숫자만 normalize 후)
 *  - + name_kr 또는 name_vi 둘 중 하나가 일치 (대소문자 무시, 공백 trim)
 *  - 이미 다른 auth_user_id 와 매핑된 row 는 제외 (already_mapped)
 *  - 일치 시 auth_user_id 업데이트
 */
export async function verifyAndMap(input: VerifyInput): Promise<VerifyResult> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const namePattern = parsed.data.name.trim();
  const phoneDigits = parsed.data.phone.replace(/\D/g, "");

  // 이미 매핑됐으면 통과
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existing) {
    return { ok: true, mapped: true, customerId: existing.id };
  }

  // 후보 검색 — phone 부분 매칭 (정규화 후 끝 8자리 일치)
  // SQL 측 ilike 로 phone like '%XXXX%' + name 매치
  const { data: candidates, error } = await supabase
    .from("customers")
    .select("id, name_kr, name_vi, phone, auth_user_id")
    .is("auth_user_id", null);

  if (error) return { ok: false, error: error.message };
  if (!candidates || candidates.length === 0) {
    return { ok: true, mapped: false, reason: "no_match" };
  }

  // 클라이언트 측 정규화 매칭
  const matchedCustomer = candidates.find((c) => {
    const cPhone = (c.phone ?? "").replace(/\D/g, "");
    if (!cPhone || !phoneDigits) return false;

    // phone 끝 8자리 정확히 일치 (010 / +82 / 하이픈 등 무관)
    const phoneMatch =
      cPhone === phoneDigits ||
      cPhone.endsWith(phoneDigits) ||
      phoneDigits.endsWith(cPhone) ||
      cPhone.slice(-8) === phoneDigits.slice(-8);

    if (!phoneMatch) return false;

    // 이름 매칭 — 한 글 또는 베트남어 둘 중 하나 일치 (대소문자·공백 무시)
    const target = namePattern.toLowerCase().replace(/\s+/g, "");
    const ko = (c.name_kr ?? "").toLowerCase().replace(/\s+/g, "");
    const vi = (c.name_vi ?? "").toLowerCase().replace(/\s+/g, "");
    const nameMatch =
      (ko && (ko === target || ko.includes(target) || target.includes(ko))) ||
      (vi && (vi === target || vi.includes(target) || target.includes(vi)));

    return nameMatch;
  });

  if (!matchedCustomer) {
    return { ok: true, mapped: false, reason: "no_match" };
  }

  // 매핑
  const { error: updateError } = await supabase
    .from("customers")
    .update({ auth_user_id: user.id })
    .eq("id", matchedCustomer.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true, mapped: true, customerId: matchedCustomer.id };
}
