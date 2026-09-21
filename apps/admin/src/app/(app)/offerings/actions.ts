"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { assessOfferingReadiness } from "@/lib/admission/assess-offering-readiness";

type OfferingInsert = Database["public"]["Tables"]["study_offerings"]["Insert"];
type OfferingUpdate = Database["public"]["Tables"]["study_offerings"]["Update"];
type OfferingStatus = Database["public"]["Tables"]["study_offerings"]["Row"]["status"];
type Language = Database["public"]["Tables"]["study_offerings"]["Row"]["available_languages"][number];
type Location = Database["public"]["Tables"]["study_offerings"]["Row"]["location_options"][number];

const LANGUAGES = ["korean", "english", "other"] as const;
const LOCATIONS = ["domestic", "overseas"] as const;

export type ActionResult = { ok: true; warnings?: string[] } | { ok: false; error: string };

export type ReadinessResult =
  | { ok: false; blocked: true; reason: string }
  | { ok: true; blocked: false; warnings: string[] };

const DUP_MSG = "이미 같은 대학·학과·학기의 모집이 있습니다.";

async function requireUser() {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  return user;
}

/** 대학의 요강(보관 아님) id — 모집의 source_spec_id 는 항상 이것 */
async function activeSpecIdOf(
  supabase: ReturnType<typeof createAdminClient>,
  universityId: number
): Promise<string | null> {
  const { data } = await supabase
    .from("study_admission_specs")
    .select("id")
    .eq("university_id", universityId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

const createSchema = z.object({
  university_id: z.number().int().positive(),
  department_id: z.number().int().positive(),
  term: z.string().trim().min(1).max(100),
});

/**
 * 모집 칸 추가 — (대학, 학과, 학기) 초안 행 INSERT. 요강 연결은 대학의 요강으로 자동.
 */
export async function createOfferingAction(input: {
  university_id: number;
  department_id: number;
  term: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "입력값을 확인하세요 (학기는 1~100자)" };
  const data = parsed.data;

  const supabase = createAdminClient();
  const specId = await activeSpecIdOf(supabase, data.university_id);
  if (!specId) return { ok: false, error: "이 대학의 모집요강이 없습니다. 모집요강을 먼저 등록하세요." };

  const ins: OfferingInsert = {
    university_id: data.university_id,
    department_id: data.department_id,
    term: data.term,
    status: "draft",
    source_spec_id: specId,
    sort_order: 0,
    created_by: user.id,
  };
  const { error } = await supabase.from("study_offerings").insert(ins);
  if (error) return { ok: false, error: error.code === "23505" ? DUP_MSG : `추가 실패: ${error.message}` };

  revalidatePath("/offerings");
  return { ok: true };
}

/**
 * 오픈 전 준비도 확인 (확인창용) — 저장하지 않는다.
 */
export async function checkOfferingReadinessAction(id: string): Promise<ReadinessResult> {
  const user = await requireUser();
  if (!user) return { ok: false, blocked: true, reason: "로그인이 필요합니다" };
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("study_offerings")
    .select("university_id, department_id, term, intake_quota")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, blocked: true, reason: "모집을 찾을 수 없습니다" };
  if (row.intake_quota == null) {
    return { ok: false, blocked: true, reason: "오픈하려면 글로케어 모집 인원을 먼저 입력하세요." };
  }
  const r = await assessOfferingReadiness(row.university_id, row.department_id, row.term);
  if (r.blocked) return { ok: false, blocked: true, reason: r.reason };
  return { ok: true, blocked: false, warnings: r.warnings };
}

/**
 * 상태 변경 — 오픈(published) / 마감(closed) / 초안(draft).
 *   published 전환은 정원 필수 + 준비도 게이트. source_spec_id 가 비어 있으면 대학 요강으로 채운다.
 */
export async function updateOfferingStatusAction(
  id: string,
  status: OfferingStatus
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("study_offerings")
    .select("university_id, department_id, term, intake_quota, source_spec_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "모집을 찾을 수 없습니다" };

  let warnings: string[] = [];
  const patch: OfferingUpdate = { status };
  if (status === "published") {
    if (row.intake_quota == null) return { ok: false, error: "오픈하려면 글로케어 모집 인원을 먼저 입력하세요." };
    const readiness = await assessOfferingReadiness(row.university_id, row.department_id, row.term);
    if (readiness.blocked) return { ok: false, error: readiness.reason };
    warnings = readiness.warnings;
    if (row.source_spec_id !== readiness.specId) patch.source_spec_id = readiness.specId;
  } else if (!row.source_spec_id) {
    const specId = await activeSpecIdOf(supabase, row.university_id);
    if (specId) patch.source_spec_id = specId;
  }

  const { error } = await supabase.from("study_offerings").update(patch).eq("id", id);
  if (error) return { ok: false, error: `상태 변경 실패: ${error.message}` };
  revalidatePath("/offerings");
  return { ok: true, warnings };
}

/**
 * 인원 인라인 수정.
 *   field = "intake_quota" (글로케어 모집 인원, 기본) — 오픈 중인 모집은 비울 수 없다 (DB CHECK 와 동일).
 *   field = "total_quota"  (학교 전체 정원, 0069) — 선택 값, 언제든 비울 수 있다.
 */
export async function updateOfferingQuotaAction(
  id: string,
  quota: number | null,
  field: "intake_quota" | "total_quota" = "intake_quota"
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  if (field !== "intake_quota" && field !== "total_quota") return { ok: false, error: "잘못된 항목" };
  if (quota != null && (!Number.isInteger(quota) || quota < 0 || quota > 100000)) {
    return { ok: false, error: "인원은 0~100000 사이 정수" };
  }
  const supabase = createAdminClient();
  if (quota == null && field === "intake_quota") {
    const { data: row } = await supabase.from("study_offerings").select("status").eq("id", id).maybeSingle();
    if (row?.status === "published") return { ok: false, error: "오픈 중인 모집은 글로케어 인원을 비울 수 없습니다." };
  }
  const patch: OfferingUpdate = field === "total_quota" ? { total_quota: quota } : { intake_quota: quota };
  const { error } = await supabase.from("study_offerings").update(patch).eq("id", id);
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };
  revalidatePath("/offerings");
  return { ok: true };
}

/**
 * 부가 옵션 — 수업 언어 / 지원 위치 / 메모.
 */
export async function updateOfferingOptionsAction(
  id: string,
  input: { available_languages: string[]; location_options: string[]; notes: string | null }
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const langs = input.available_languages.filter((l): l is Language => (LANGUAGES as readonly string[]).includes(l));
  const locs = input.location_options.filter((l): l is Location => (LOCATIONS as readonly string[]).includes(l));
  const notes = (input.notes ?? "").trim().slice(0, 2000) || null;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("study_offerings")
    .update({ available_languages: langs, location_options: locs, notes })
    .eq("id", id);
  if (error) return { ok: false, error: `저장 실패: ${error.message}` };
  revalidatePath("/offerings");
  return { ok: true };
}

/**
 * 모집 삭제 — 초안만. 오픈/마감된 모집은 지우지 않는다(이력·지원서 보호). 필요하면 초안으로 내린 뒤 삭제.
 */
export async function deleteOfferingAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다" };
  const supabase = createAdminClient();
  const { data: row } = await supabase.from("study_offerings").select("status").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "모집을 찾을 수 없습니다" };
  if (row.status !== "draft") {
    return { ok: false, error: "초안 상태의 모집만 삭제할 수 있습니다. 먼저 '초안으로' 내리세요." };
  }
  const { error } = await supabase.from("study_offerings").delete().eq("id", id);
  if (error) return { ok: false, error: `삭제 실패: ${error.message}` };
  revalidatePath("/offerings");
  return { ok: true };
}
