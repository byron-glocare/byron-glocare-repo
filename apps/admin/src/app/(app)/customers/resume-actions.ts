"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireAuth } from "@/lib/require-auth";
import { polishResumeNarrative } from "@/lib/resume/polish";
import { resumeDraftDataSchema } from "@/lib/validators";

export type ResumeActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 학생에게 보낼 이력서 작성 링크 생성. 기존 미제출 draft 가 있으면
 * 그것의 token 을 갱신해서 7일 더 연장 (재발급).
 */
/** 베트남 이름 → ASCII slug (소문자, 공백/특수문자 → 하이픈) */
function slugifyName(name: string | null | undefined): string {
  if (!name) return "anon";
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d");
  return (
    ascii
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "anon"
  );
}

/** 사람이 읽기 좋은 token 후보 — 안 되면 (충돌) 짧은 randomUUID 끝 4자 붙임 */
function buildHumanToken(name: string | null, phone: string | null): string {
  const slug = slugifyName(name);
  const digits = (phone ?? "").replace(/\D/g, "");
  const tail = digits.slice(-4) || randomUUID().replace(/-/g, "").slice(0, 4);
  return `${slug}-${tail}`;
}

export async function createResumeDraft(
  customerId: string
): Promise<ResumeActionResult<{ token: string; expiresAt: string }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  // customer 의 알려진 정보 가져오기 — token + prefill 둘 다 사용
  const { data: customer } = await supabase
    .from("customers")
    .select("name_vi, name_kr, phone, email, birth_year, topik_level, address")
    .eq("id", customerId)
    .single();

  const baseToken = buildHumanToken(
    customer?.name_vi || customer?.name_kr || null,
    customer?.phone ?? null
  );

  // token 중복 시 4자리 random suffix 붙여 재시도 (최대 5번)
  let token = baseToken;
  for (let i = 0; i < 5; i++) {
    const { data: dup } = await supabase
      .from("resume_drafts")
      .select("id")
      .eq("token", token)
      .maybeSingle();
    if (!dup) break;
    token = `${baseToken}-${randomUUID().replace(/-/g, "").slice(0, 4)}`;
  }

  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

  // prefill 데이터 — customer 의 알려진 값. customer 가 비어있으면 빈 문자열.
  // TOPIK / 요양보호사 자격증 / 한국어·베트남어 행 자동 추가.
  const prefillData = {
    name_vi: customer?.name_vi ?? "",
    name_kr: customer?.name_kr ?? "",
    birth_date: customer?.birth_year ? `${customer.birth_year}년` : "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    one_liner: "",
    narrative_raw: "",
    narrative_polished: "",
    educations: [],
    careers: [],
    certifications: [
      { name: "요양보호사 자격증", date: "", detail: "" },
      {
        name: "TOPIK",
        date: "",
        detail: customer?.topik_level ? `${customer.topik_level}급` : "",
      },
    ],
    skills: [
      { name: "베트남어", detail: "모국어", level: "모국어" },
      { name: "한국어", detail: "", level: "" },
    ],
    activities: [],
  };

  // 기존 draft (미제출) 있으면 재발급, 없으면 새로 생성
  const { data: existing } = await supabase
    .from("resume_drafts")
    .select("id, submitted_at, data")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = existing?.[0];
  if (last && !last.submitted_at) {
    // 기존 데이터 보존 — token + 만료만 갱신
    const { error } = await supabase
      .from("resume_drafts")
      .update({ token, expires_at: expiresAt })
      .eq("id", last.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("resume_drafts").insert({
      customer_id: customerId,
      token,
      expires_at: expiresAt,
      data: prefillData,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: { token, expiresAt } };
}

/**
 * AI 다듬기 재실행 — polished 결과가 마음에 안 들 때 관리자가 한 번 더 호출.
 * raw 는 그대로 두고 polished 만 갱신.
 */
export async function regenerateResumePolish(
  customerId: string,
  draftId: string
): Promise<ResumeActionResult<{ polished: string }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: draft, error: fetchErr } = await supabase
    .from("resume_drafts")
    .select("id, data")
    .eq("id", draftId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!draft) return { ok: false, error: "draft 를 찾을 수 없습니다." };

  const parsed = resumeDraftDataSchema.safeParse(draft.data);
  if (!parsed.success) {
    return { ok: false, error: "이력서 데이터 파싱 실패" };
  }

  const raw = parsed.data.narrative_raw.trim();
  if (raw.length < 20) {
    return { ok: false, error: "원본 자기소개가 너무 짧습니다." };
  }

  const r = await polishResumeNarrative({
    rawText: raw,
    studentName: parsed.data.name_kr || parsed.data.name_vi,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const { error } = await supabase
    .from("resume_drafts")
    .update({
      data: { ...parsed.data, narrative_polished: r.polished },
    })
    .eq("id", draft.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: { polished: r.polished } };
}

/** 이력서 draft 폐기 — 다시 생성 가능 */
export async function deleteResumeDraft(
  customerId: string,
  draftId: string
): Promise<ResumeActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("resume_drafts")
    .delete()
    .eq("id", draftId)
    .eq("customer_id", customerId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}
