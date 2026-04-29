"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

// =============================================================================
// 교육 신청 (training_signup) — 새 customer row 생성 + 현재 auth 와 link
// =============================================================================

const trainingSignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해주세요. / Vui lòng nhập họ tên."),
  phone: z
    .string()
    .trim()
    .min(1, "전화번호를 입력해주세요. / Vui lòng nhập số điện thoại."),
  email: z
    .string()
    .trim()
    .email("이메일 형식이 올바르지 않습니다.")
    .optional()
    .or(z.literal("")),
  region: z.string().trim().optional().nullable(),
  topik_level: z.string().trim().optional().nullable(),
  visa_type: z.string().trim().optional().nullable(),
  message: z.string().trim().optional().nullable(),
});

export type TrainingSignupInput = z.input<typeof trainingSignupSchema>;

export type TrainingSignupResult =
  | { ok: true; needsLogin: false }
  | { ok: true; needsLogin: true }
  | { ok: false; error: string };

/**
 * 교육 신청 — 본인 정보 입력 → customers row 생성 + auth 와 매핑.
 *
 * 흐름:
 *  1. SNS 로그인 안 됐으면 needsLogin=true 반환 (UI 가 /login?next=... 로 보냄)
 *  2. 이미 customer 매핑되어 있으면 → caregiver_contacts 에 추가 문의로 저장
 *  3. unmapped 상태면 → 새 customer 생성 (code 자동) + auth_user_id link
 */
export async function submitTrainingSignup(
  input: TrainingSignupInput
): Promise<TrainingSignupResult> {
  const parsed = trainingSignupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, needsLogin: true };
  }

  // 이미 매핑된 customer 가 있으면 별도 문의로 처리
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("caregiver_contacts").insert({
      kind: "training_signup",
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      region: data.region || null,
      topik_level: data.topik_level || null,
      visa_type: data.visa_type || null,
      message: data.message || null,
      auth_user_id: user.id,
    });
    return { ok: true, needsLogin: false };
  }

  // 새 customer 생성 + 매핑
  // code 는 admin 패턴 (CXXXX...) 따라 임시 생성 — 실제 운영에서는 trigger 또는
  // generateCode(supabase, 'customers') 함수 권장. 여기서는 timestamp 기반.
  const ts = Date.now().toString(36).toUpperCase();
  const code = `C${ts}`;

  const { error: insertError } = await supabase.from("customers").insert({
    code,
    name_kr: data.name,
    name_vi: null,
    phone: data.phone,
    email: data.email || null,
    desired_region: data.region || null,
    topik_level: data.topik_level || null,
    visa_type: data.visa_type || null,
    auth_user_id: user.id,
  });

  if (insertError) return { ok: false, error: insertError.message };

  // 백업으로 caregiver_contacts 에도 기록
  await supabase.from("caregiver_contacts").insert({
    kind: "training_signup",
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    region: data.region || null,
    topik_level: data.topik_level || null,
    visa_type: data.visa_type || null,
    message: data.message || null,
    auth_user_id: user.id,
  });

  return { ok: true, needsLogin: false };
}

// =============================================================================
// 제휴 문의 (partnership)
// =============================================================================

const partnershipSchema = z.object({
  name: z.string().trim().min(1, "담당자 이름을 입력해주세요."),
  company: z.string().trim().min(1, "회사/기관명을 입력해주세요."),
  email: z.string().trim().email("이메일 형식이 올바르지 않습니다."),
  phone: z.string().trim().optional().nullable(),
  message: z.string().trim().optional().nullable(),
});

export type PartnershipInput = z.input<typeof partnershipSchema>;

export async function submitPartnership(
  input: PartnershipInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = partnershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("caregiver_contacts").insert({
    kind: "partnership",
    name: data.name,
    company: data.company,
    email: data.email,
    phone: data.phone || null,
    message: data.message || null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
