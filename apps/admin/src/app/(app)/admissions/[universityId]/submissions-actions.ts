"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type RequiredSubmissionInsert =
  Database["public"]["Tables"]["study_required_submissions"]["Insert"];
type RequiredSubmissionUpdate =
  Database["public"]["Tables"]["study_required_submissions"]["Update"];
type IssuanceRequirements =
  Database["public"]["Tables"]["study_required_submissions"]["Row"]["issuance_requirements"];

// 샘플 이미지는 양식 템플릿과 같은 공개 버킷에 보관 (빈 예시 문서 — 민감정보 아님).
//   추후 비공개 전환 시: 별도 버킷 + 서명 URL 로 교체.
const BUCKET = "admission-form-files";
const SAMPLE_PREFIX = "required-submissions";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const STATUSES = ["draft", "approved", "archived"] as const;
const TARGET_PERSONS = ["self", "father", "mother", "other"] as const;

const saveSchema = z.object({
  // 공용(전체 공통)이면 null, 대학별이면 대학 id
  university_id: z.number().int().positive().nullable(),
  department_id: z.number().int().positive().nullable(),
  name_ko: z.string().min(1).max(300),
  name_vi: z.string().max(300).nullable(),
  // 서류 대상자
  target_person: z.enum(TARGET_PERSONS).nullable(),
  target_person_note: z.string().max(500).nullable(),
  status: z.enum(STATUSES),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999),
  // 발급 요건
  iss_issuer: z.string().max(300).nullable(),
  iss_validity_days: z.coerce.number().int().min(0).max(36500).nullable(),
  iss_lead_time_days: z.coerce.number().int().min(0).max(3650).nullable(),
  iss_needs_notarization: z.boolean(),
  iss_needs_translation: z.boolean(),
  iss_notes: z.string().max(2000).nullable(),
});

export type SaveRequiredSubmissionState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      success?: boolean;
    }
  | undefined;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = emptyToNull(v);
  return s === null ? null : Number(s);
}

function parseJsonStringArray(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    // 무시
  }
  return [];
}

function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot >= 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot >= 0 ? name.slice(lastDot) : "";
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return safe + ext;
}

/** public URL 에서 버킷 내부 path 추출 (삭제용) */
function pathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(new RegExp(`${BUCKET}/(.+)$`));
  return m ? m[1] : null;
}

/**
 * 직접제출 서류 생성/수정.
 *   id=null → INSERT, id=string → UPDATE.
 *   샘플 이미지: sample_base64 가 있으면 업로드(+기존 교체), 없으면 기존 유지.
 */
export async function saveRequiredSubmissionAction(
  id: string | null,
  _prev: SaveRequiredSubmissionState,
  formData: FormData
): Promise<SaveRequiredSubmissionState> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  const supabase = createAdminClient();

  const raw = {
    university_id: numOrNull(formData.get("university_id")),
    department_id: numOrNull(formData.get("department_id")),
    name_ko: formData.get("name_ko"),
    name_vi: emptyToNull(formData.get("name_vi")),
    target_person: emptyToNull(formData.get("target_person")),
    target_person_note: emptyToNull(formData.get("target_person_note")),
    status: formData.get("status") || "draft",
    is_active: formData.get("is_active") === "on",
    sort_order: formData.get("sort_order") || "0",
    iss_issuer: emptyToNull(formData.get("iss_issuer")),
    iss_validity_days: numOrNull(formData.get("iss_validity_days")),
    iss_lead_time_days: numOrNull(formData.get("iss_lead_time_days")),
    iss_needs_notarization: formData.get("iss_needs_notarization") === "on",
    iss_needs_translation: formData.get("iss_needs_translation") === "on",
    iss_notes: emptyToNull(formData.get("iss_notes")),
  };

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "");
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { fieldErrors: fe };
  }
  const data = parsed.data;

  const requiredKeys = parseJsonStringArray(
    formData.get("required_data_type_keys")
  );
  const aliases = parseJsonStringArray(formData.get("aliases"));
  // 대학별 오버라이드면 공용 마스터 id 참조 (공용/대학전용이면 null)
  const baseSubmissionId = emptyToNull(formData.get("base_submission_id"));

  // 발급요건 jsonb 구성 (빈값은 생략)
  const issuance: IssuanceRequirements = {};
  if (data.iss_issuer) issuance.issuer = data.iss_issuer;
  if (data.iss_validity_days != null)
    issuance.validity_days = data.iss_validity_days;
  if (data.iss_lead_time_days != null)
    issuance.lead_time_days = data.iss_lead_time_days;
  if (data.iss_needs_notarization) issuance.needs_notarization = true;
  if (data.iss_needs_translation) issuance.needs_translation = true;
  if (data.iss_notes) issuance.notes = data.iss_notes;

  // 샘플 이미지 업로드 (선택)
  let newSampleUrl: string | null = null;
  let uploadedPath: string | null = null;
  const sampleBase64 = formData.get("sample_base64");
  if (typeof sampleBase64 === "string" && sampleBase64.trim() !== "") {
    const sampleName = String(formData.get("sample_name") ?? "sample.png");
    const sampleType = String(formData.get("sample_type") ?? "image/png");
    const buffer = Buffer.from(sampleBase64, "base64");
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return { error: "샘플 이미지가 너무 큽니다 (최대 10MB)" };
    }
    const safe = sanitizeFileName(sampleName);
    const path = `${SAMPLE_PREFIX}/${data.university_id ?? "global"}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: sampleType || "image/png",
        upsert: false,
      });
    if (upErr) return { error: `샘플 이미지 업로드 실패: ${upErr.message}` };
    uploadedPath = path;
    newSampleUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data
      .publicUrl;
  }

  if (id) {
    // UPDATE
    const { data: orig } = await supabase
      .from("study_required_submissions")
      .select("id, university_id, sample_image_url")
      .eq("id", id)
      .maybeSingle();
    if (!orig) return { error: "서류를 찾을 수 없습니다" };

    const patch: RequiredSubmissionUpdate = {
      department_id: data.department_id,
      name_ko: data.name_ko,
      name_vi: data.name_vi,
      target_person: data.target_person,
      target_person_note: data.target_person_note,
      status: data.status,
      is_active: data.is_active,
      sort_order: data.sort_order,
      issuance_requirements: issuance,
      required_data_type_keys: requiredKeys,
      aliases,
    };
    if (newSampleUrl) patch.sample_image_url = newSampleUrl;

    const { error: updErr } = await supabase
      .from("study_required_submissions")
      .update(patch)
      .eq("id", id);
    if (updErr) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      return { error: `수정 실패: ${updErr.message}` };
    }

    // 새 이미지로 교체했으면 기존 이미지 제거 (best-effort)
    if (newSampleUrl) {
      const oldPath = pathFromUrl(orig.sample_image_url);
      if (oldPath && oldPath !== uploadedPath) {
        await supabase.storage.from(BUCKET).remove([oldPath]);
      }
    }
  } else {
    // INSERT
    const ins: RequiredSubmissionInsert = {
      university_id: data.university_id,
      base_submission_id: baseSubmissionId,
      department_id: data.department_id,
      name_ko: data.name_ko,
      name_vi: data.name_vi,
      target_person: data.target_person,
      target_person_note: data.target_person_note,
      status: data.status,
      is_active: data.is_active,
      sort_order: data.sort_order,
      issuance_requirements: issuance,
      required_data_type_keys: requiredKeys,
      aliases,
      sample_image_url: newSampleUrl,
      created_by: user.id,
    };
    const { error: insErr } = await supabase
      .from("study_required_submissions")
      .insert(ins);
    if (insErr) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      return { error: `저장 실패: ${insErr.message}` };
    }
  }

  // 공용(university_id=null)·대학별 양쪽 화면 갱신
  revalidatePath("/admissions");
  if (data.university_id) revalidatePath(`/admissions/${data.university_id}`);
  return { success: true };
}

/**
 * 직접제출 서류 삭제 (+ 샘플 이미지 제거).
 */
export async function deleteRequiredSubmissionAction(
  id: string,
  universityId: number | null
): Promise<void> {
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) return;

  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("study_required_submissions")
    .select("id, sample_image_url")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  const path = pathFromUrl(row.sample_image_url);
  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }

  await supabase.from("study_required_submissions").delete().eq("id", id);

  revalidatePath("/admissions");
  if (universityId) revalidatePath(`/admissions/${universityId}`);
}
