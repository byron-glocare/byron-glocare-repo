"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/require-auth";
import { isVietnamese, translateToKorean } from "@/lib/translate";
import { analyzeConsultation } from "@/lib/analyze-consultation";
import type { ConsultationAnalysis } from "@/lib/consultation-tags";
import {
  customerSchema,
  consultationSchema,
  statusFlagsSchema,
  progressStateSchema,
  consultationWriteSchema,
  consultationUpdateSchema,
  type CustomerInput,
  type ConsultationInput,
  type StatusFlagsInput,
  type ProgressStateInput,
  type ConsultationWriteInput,
  type ConsultationUpdateInput,
} from "@/lib/validators";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// =============================================================================
// 고객 코드 자동 발급 — CVN + YYMM + 순번 3자리
// =============================================================================

async function generateCustomerCode(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  // KST 기준 연·월로 CVN+YYMM 접두사 생성 (서버 timezone 무관)
  const kst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date());
  const yy = kst.find((p) => p.type === "year")?.value ?? "00";
  const mm = kst.find((p) => p.type === "month")?.value ?? "00";
  const prefix = `CVN${yy}${mm}`;

  const { data } = await supabase
    .from("customers")
    .select("code")
    .ilike("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  let next = 1;
  if (data && data.length > 0) {
    const last = data[0].code;
    const lastNum = parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(lastNum)) next = lastNum + 1;
  }

  return `${prefix}${String(next).padStart(3, "0")}`;
}

// =============================================================================
// 교육원 매칭 시 '교육원 발굴' 플래그 자동 리셋 (§5.1.2)
// =============================================================================
async function applyCenterFindingAutoReset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  newTrainingCenterId: string | null
) {
  if (newTrainingCenterId) {
    await supabase
      .from("customer_statuses")
      .update({ training_center_finding: false })
      .eq("customer_id", customerId);
  }
}

// 요양원 매칭 시 '요양원 발굴' 플래그 리셋 (§5.1.4)
async function applyCareHomeFindingAutoReset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  newCareHomeId: string | null
) {
  if (newCareHomeId) {
    await supabase
      .from("customer_statuses")
      .update({ care_home_finding: false })
      .eq("customer_id", customerId);
  }
}

// =============================================================================
// 고객 CRUD
// =============================================================================

export async function createCustomer(input: CustomerInput) {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }

  const code = await generateCustomerCode(supabase);

  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.data, code })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  // customer_statuses 는 DB 트리거로 자동 생성됨

  // 교육원 매칭과 함께 등록했다면 발굴 플래그 리셋
  if (parsed.data.training_center_id) {
    await applyCenterFindingAutoReset(
      supabase,
      data.id,
      parsed.data.training_center_id
    );
  }
  if (parsed.data.care_home_id) {
    await applyCareHomeFindingAutoReset(
      supabase,
      data.id,
      parsed.data.care_home_id
    );
  }

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("customers")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await applyCenterFindingAutoReset(
    supabase,
    id,
    parsed.data.training_center_id ?? null
  );
  await applyCareHomeFindingAutoReset(
    supabase,
    id,
    parsed.data.care_home_id ?? null
  );

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true, data: null };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/customers");
  redirect("/customers");
}

// =============================================================================
// 진행 단계 플래그 업데이트
// =============================================================================

export async function updateStatusFlags(
  customerId: string,
  input: StatusFlagsInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = statusFlagsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("customer_statuses")
    .update(parsed.data)
    .eq("customer_id", customerId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

/**
 * 진행 단계 탭 전용 통합 저장.
 * customer_statuses 플래그 + customers 의 termination_reason / is_waiting /
 * recontact_date / waiting_memo 를 한 번에 갱신.
 */
export async function updateProgressState(
  customerId: string,
  input: ProgressStateInput
): Promise<ActionResult> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = progressStateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { flags, termination_reason, is_waiting, recontact_date, waiting_memo } =
    parsed.data;

  const [flagRes, custRes] = await Promise.all([
    supabase
      .from("customer_statuses")
      .update(flags)
      .eq("customer_id", customerId),
    supabase
      .from("customers")
      .update({
        termination_reason,
        is_waiting,
        recontact_date,
        waiting_memo,
      })
      .eq("id", customerId),
  ]);

  if (flagRes.error) return { ok: false, error: flagRes.error.message };
  if (custRes.error) return { ok: false, error: custRes.error.message };

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { ok: true, data: null };
}

// =============================================================================
// 상담 일지
// =============================================================================

/**
 * (레거시) 베트남어/한국어 두 필드 분리 입력.
 * 신규 UI 는 createConsultationWithAnalysis 사용 권장.
 */
export async function createConsultation(
  customerId: string,
  input: ConsultationInput
): Promise<ActionResult> {
  const parsed = consultationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  if (
    !parsed.data.content_vi?.trim() &&
    !parsed.data.content_kr?.trim()
  ) {
    return {
      ok: false,
      error: "상담 내용을 입력해주세요 (베트남어 또는 한국어).",
    };
  }

  let user, supabase;
  try {
    ({ user, supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase.from("customer_consultations").insert({
    customer_id: customerId,
    consultation_type: parsed.data.consultation_type,
    content_vi: parsed.data.content_vi ?? null,
    content_kr: parsed.data.content_kr ?? null,
    author_id: user.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: null };
}

// =============================================================================
// 상담 일지 (신규) — 단일 content 입력 + 자동 번역 + AI 분석
// =============================================================================

/**
 * 본문을 감지해 content_vi / content_kr 로 분리.
 * 베트남어 감지 시 Google Translate 로 한국어 동시 저장.
 */
async function prepareConsultationContent(
  content: string
): Promise<{ content_vi: string | null; content_kr: string | null }> {
  const trimmed = content.trim();
  if (isVietnamese(trimmed)) {
    const translated = await translateToKorean(trimmed);
    return {
      content_vi: trimmed,
      // 번역 실패 시 원문과 동일 반환 — kr 에도 원문을 넣어두고 사용자가 편집 가능
      content_kr: translated,
    };
  }
  return { content_vi: null, content_kr: trimmed };
}

/**
 * Claude Haiku 호출로 상담 분석. 실패 시 null — 상담 저장 자체는 계속.
 */
async function runConsultationAnalysis(
  content: string,
  consultation_type: "training_center" | "care_home"
): Promise<ConsultationAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return analyzeConsultation(apiKey, content, consultation_type);
}

/**
 * 신규 상담 작성. 저장 후 분석 결과(suggestions) 를 반환 →
 * 클라이언트가 검토 다이얼로그로 사용자 승인 후 applyAnalysisSuggestions 호출.
 */
export async function createConsultationWithAnalysis(
  input: ConsultationWriteInput
): Promise<
  ActionResult<{
    consultation_id: string;
    analysis: ConsultationAnalysis | null;
  }>
> {
  const parsed = consultationWriteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  let user, supabase;
  try {
    ({ user, supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { customer_id, consultation_type, content } = parsed.data;

  // 번역 + 분석을 병렬
  const [prepared, analysis] = await Promise.all([
    prepareConsultationContent(content),
    runConsultationAnalysis(content, consultation_type),
  ]);

  const { data, error } = await supabase
    .from("customer_consultations")
    .insert({
      customer_id,
      consultation_type,
      content_vi: prepared.content_vi,
      content_kr: prepared.content_kr,
      tags: analysis?.tags ?? [],
      author_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "저장 실패" };
  }

  revalidatePath(`/customers/${customer_id}`);
  return {
    ok: true,
    data: { consultation_id: data.id, analysis },
  };
}

/**
 * 기존 상담 수정. 본문만 갱신 — consultation_type / customer_id 는 불변.
 * 저장 후 분석 다시 돌림 (태그/suggestions 갱신).
 */
export async function updateConsultation(
  input: ConsultationUpdateInput
): Promise<ActionResult<{ analysis: ConsultationAnalysis | null }>> {
  const parsed = consultationUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const { consultation_id, content } = parsed.data;

  // 기존 레코드 조회 — consultation_type 과 customer_id 필요
  const { data: existing, error: fetchError } = await supabase
    .from("customer_consultations")
    .select("customer_id, consultation_type")
    .eq("id", consultation_id)
    .single();
  if (fetchError || !existing) {
    return { ok: false, error: "상담 일지를 찾을 수 없습니다." };
  }

  const [prepared, analysis] = await Promise.all([
    prepareConsultationContent(content),
    runConsultationAnalysis(
      content,
      existing.consultation_type as "training_center" | "care_home"
    ),
  ]);

  const { error } = await supabase
    .from("customer_consultations")
    .update({
      content_vi: prepared.content_vi,
      content_kr: prepared.content_kr,
      tags: analysis?.tags ?? [],
    })
    .eq("id", consultation_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${existing.customer_id}`);
  return { ok: true, data: { analysis } };
}

// =============================================================================
// AI 제안 적용 (customer + status_flags 일괄 업데이트, 화이트리스트 검증)
// =============================================================================

/**
 * 분석 결과 중 사용자가 체크한 항목만 반영해 customer / customer_statuses
 * 를 업데이트. 화이트리스트 외 필드는 서버에서 무시.
 */
export async function applyAnalysisSuggestions(
  customerId: string,
  selected: {
    customer?: Partial<ConsultationAnalysis["suggestions"]["customer"]>;
    status_flags?: Partial<ConsultationAnalysis["suggestions"]["status_flags"]>;
  }
): Promise<ActionResult<{ applied: number }>> {
  let supabase;
  try {
    ({ supabase } = await requireAuth());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  // 서버측 화이트리스트 재검증 (클라 조작 방어)
  const customerWhitelist = [
    "topik_level",
    "visa_type",
    "desired_region",
    "desired_period",
    "desired_time",
    "birth_year",
  ] as const;
  const flagWhitelist = [
    "intake_abandoned",
    "study_abroad_consultation",
    "training_center_finding",
    "class_schedule_confirmation_needed",
    "training_reservation_abandoned",
    "certificate_acquired",
    "training_dropped",
    "welcome_pack_abandoned",
    "care_home_finding",
    "resume_sent",
    "interview_passed",
  ] as const;

  type CustomerPatch = Partial<
    Pick<
      ConsultationAnalysis["suggestions"]["customer"],
      (typeof customerWhitelist)[number]
    >
  >;
  type FlagsPatch = Partial<
    Pick<
      ConsultationAnalysis["suggestions"]["status_flags"],
      (typeof flagWhitelist)[number]
    >
  >;

  const customerPatch: CustomerPatch = {};
  for (const k of customerWhitelist) {
    const v = selected.customer?.[k];
    if (v !== undefined) {
      // 런타임 화이트리스트 + TS 키별 매핑은 assign 으로 처리
      (customerPatch as Record<string, unknown>)[k] = v;
    }
  }
  const flagsPatch: FlagsPatch = {};
  for (const k of flagWhitelist) {
    const v = selected.status_flags?.[k];
    if (v !== undefined) {
      (flagsPatch as Record<string, unknown>)[k] = v;
    }
  }

  const applied =
    Object.keys(customerPatch).length + Object.keys(flagsPatch).length;
  if (applied === 0) {
    return { ok: true, data: { applied: 0 } };
  }

  if (Object.keys(customerPatch).length > 0) {
    const { error } = await supabase
      .from("customers")
      .update(customerPatch)
      .eq("id", customerId);
    if (error) return { ok: false, error: error.message };
  }
  if (Object.keys(flagsPatch).length > 0) {
    const { error } = await supabase
      .from("customer_statuses")
      .update(flagsPatch)
      .eq("customer_id", customerId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { ok: true, data: { applied } };
}
